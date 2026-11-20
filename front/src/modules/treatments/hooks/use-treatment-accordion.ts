import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"

/** Treatment editor only; Base UI measures panels and signals the end of each exit. */
export function useTreatmentAccordion(form: RefObject<HTMLFormElement | null>) {
  const [open, setOpen] = useState<string | null>("general")
  const [closing, setClosing] = useState<string | null>(null)
  const active = useRef<string | null>("general")
  const exiting = useRef<string | null>(null)
  const requested = useRef<string | null>("general")
  const focus = useRef<string | null>(null)
  const [focusVersion, setFocusVersion] = useState(0)

  const request = useCallback((next: string | null, selector?: string) => {
    requested.current = next
    focus.current = selector ?? null
    setFocusVersion(value => value + 1)
    if(exiting.current || active.current === next) return
    if(active.current) {
      const item = form.current?.querySelector<HTMLElement>(`[data-treatment-section="${active.current}"]`)
      if(item?.querySelector(".treatment-section-panel")?.contains(document.activeElement)) {
        item.querySelector<HTMLElement>(".treatment-section-trigger")?.focus({ preventScroll: true })
      }
      exiting.current = active.current
      setClosing(active.current)
      active.current = null
      setOpen(null)
    } else {
      active.current = next
      setOpen(next)
    }
  }, [form])

  useLayoutEffect(() => {
    if(!closing) return
    const panel = form.current?.querySelector<HTMLElement>(`[data-treatment-section="${closing}"] .treatment-section-panel`)
    const complete = () => {
      if(panel && !panel.hidden) return
      exiting.current = null
      active.current = requested.current
      setClosing(null)
      setOpen(requested.current)
    }
    const observer = new MutationObserver(complete)
    if(panel) observer.observe(panel, { attributes: true, attributeFilter: ["hidden"] })
    complete()
    return () => observer.disconnect()
  }, [closing, form])

  useEffect(() => {
    if(!open || closing || !focus.current) return
    let cancelled = false
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const panel = form.current?.querySelector<HTMLElement>(`[data-treatment-section="${open}"] .treatment-section-panel`)
        if(!panel) return
        void Promise.allSettled(panel.getAnimations().map(animation => animation.finished)).then(() => {
          if(cancelled || panel.hidden || !focus.current) return
          const target = panel.querySelector<HTMLElement>(focus.current)
          focus.current = null
          target?.focus({ preventScroll: true })
          const scroller = form.current?.closest<HTMLElement>(".treatment-editor-scroll")
          if(!target || !scroller) return
          const box = target.getBoundingClientRect(), bounds = scroller.getBoundingClientRect()
          const delta = box.top < bounds.top + 12 ? box.top - bounds.top - 12 : box.bottom > bounds.bottom - 12 ? box.bottom - bounds.bottom + 12 : 0
          if(delta) scroller.scrollBy({ top: delta, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
        })
      })
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [open, closing, focusVersion, form])

  return { open, request, onValueChange: (values: string[]) => request(values[0] ?? null) }
}
