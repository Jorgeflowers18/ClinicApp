/** Focus and reveal an invalid control without scrolling the background of a dialog. */
const jobs = new WeakMap<HTMLElement, () => void>()
const controls = 'input:not([type="hidden"]):not([aria-hidden="true"]),textarea,select,[role="combobox"],[role="checkbox"],[role="switch"],[role="radio"],button,[tabindex]'

export function validationTarget(root: HTMLElement, path?: string): HTMLElement | null {
  const named = path ? [...root.querySelectorAll<HTMLElement>(controls)].find(node => node.getAttribute("name") === path || node.id === path || node.getAttribute("data-validation-field") === path) : undefined
  if (named) return named
  for (const group of root.querySelectorAll<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')) {
    if (group.matches(controls) && !group.matches('[type="hidden"], [aria-hidden="true"], :disabled')) return group
    const control = group.querySelector<HTMLElement>(controls)
    if (control && !control.matches(':disabled,[type="hidden"],[aria-hidden="true"]')) return control
  }
  return null
}

export function scrollToValidationTarget(element: HTMLElement) {
  const target = element.matches('[role="radiogroup"]') || element.matches('[role="group"]') && !element.hasAttribute("tabindex")
    ? element.querySelector<HTMLElement>(controls) ?? element : element
  const dialog = target.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]')
  let ancestor = target.parentElement, scroller: HTMLElement | null = null
  while (ancestor && ancestor !== document.body) {
    if (/(auto|scroll)/.test(getComputedStyle(ancestor).overflowY) && ancestor.scrollHeight > ancestor.clientHeight + 1) { scroller = ancestor; break }
    if (ancestor === dialog) break
    ancestor = ancestor.parentElement
  }
  target.focus({ preventScroll: true })
  const group = target.closest<HTMLElement>('[data-slot="field"], [data-validation-group]') ?? target
  if (scroller) {
    const bounds = scroller.getBoundingClientRect(), box = group.getBoundingClientRect()
    const visibleTop = Math.max(bounds.top, dialog?.getBoundingClientRect().top ?? 0) + 12
    const visibleBottom = Math.min(bounds.bottom, dialog?.getBoundingClientRect().bottom ?? innerHeight) - 12
    const delta = box.top < visibleTop ? box.top - visibleTop : box.bottom > visibleBottom ? Math.min(box.top - visibleTop, box.bottom - visibleBottom) : 0
    if (delta) scroller.scrollBy({ top: delta, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
  } else if (!dialog) {
    const box = group.getBoundingClientRect()
    if (box.top < 80 || box.bottom > innerHeight - 20) group.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
  }
}

/** Existing section controllers reveal first; wait for their measured exit/entry animations. */
export function focusValidationError(root: HTMLElement | null, path?: string) {
  if (!root) return () => undefined
  jobs.get(root)?.()
  let cancelled = false, frame = 0, start = performance.now()
  const detach = () => { root.removeEventListener("pointerdown", cancel, true); root.removeEventListener("keydown", cancel, true) }
  const cancel = () => { cancelled = true; cancelAnimationFrame(frame); detach(); if (jobs.get(root) === cancel) jobs.delete(root) }
  jobs.set(root, cancel)
  // A new user action wins over a reveal queued by the previous action.
  root.addEventListener("pointerdown", cancel, true)
  root.addEventListener("keydown", cancel, true)
  function attempt() {
    if (cancelled || !root?.isConnected || performance.now() - start > 2500) { cancel(); return }
    const target = validationTarget(root, path)
    const hidden = !target || target.closest('[hidden],[inert],[aria-hidden="true"]') || !target.getClientRects().length
    const moving = target && [...root.querySelectorAll<HTMLElement>('[data-validation-panel],[data-slot="accordion-panel"],.patient-section-panel,.inventory-section-panel,.treatment-section-panel,.clinic-encounter-group-panel')].some(panel => panel.contains(target) && panel.getAnimations().some(animation => animation.playState === "running"))
    if (hidden || moving) { frame = requestAnimationFrame(attempt); return }
    scrollToValidationTarget(target)
    cancel()
  }
  frame = requestAnimationFrame(() => { frame = requestAnimationFrame(attempt) })
  return cancel
}
