import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"

// Patient forms only: Base UI owns measurement, motion completion and hidden panels.
export function usePatientAccordion(form: RefObject<HTMLFormElement | null>) {
  const [openSectionId, setOpenSectionId] = useState<string | null>("patient-section-personal")
  const [closingSectionId, setClosingSectionId] = useState<string | null>(null)
  const active = useRef<string | null>("patient-section-personal")
  const closing = useRef<string | null>(null)
  const requested = useRef<string | null>("patient-section-personal")
  const focusTarget = useRef<{ section: string; selector: string } | null>(null)
  const cancelFocus = useRef<(() => void) | null>(null)

  const focusAfterOpening = useCallback((section: string) => {
    cancelFocus.current?.()
    if (focusTarget.current?.section !== section) return
    let cancelled = false
    let frame = requestAnimationFrame(() => {
      // Allow Base UI's starting styles and measured height to reach the browser.
      frame = requestAnimationFrame(() => {
        const panel = form.current?.querySelector<HTMLElement>(`#${section} .patient-section-panel`)
        if (!panel) return
        void Promise.allSettled(panel.getAnimations().map(animation => animation.finished)).then(() => {
          const target = focusTarget.current
          if (cancelled || active.current !== section || closing.current || target?.section !== section || panel.hidden) return
          const element = form.current?.querySelector<HTMLElement>(`#${section} ${target.selector}`)
          if (!element) return
          focusTarget.current = null
          element.focus({ preventScroll: true })
          // Scroll only the form's existing container, never the background page.
          const scroller = form.current?.classList.contains("patient-dialog-form")
            ? form.current.querySelector<HTMLElement>(".patient-form-sections")
            : form.current?.closest("main")
          if (!scroller) return
          const bounds = scroller.getBoundingClientRect()
          const field = element.getBoundingClientRect()
          const offset = field.top < bounds.top + 16 ? field.top - bounds.top - 16
            : field.bottom > bounds.bottom - 16 ? field.bottom - bounds.bottom + 16 : 0
          if (offset) scroller.scrollTo({ top: scroller.scrollTop + offset, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
        })
      })
    })
    cancelFocus.current = () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [form])

  const requestSection = useCallback((section: string | null, selector?: string) => {
    cancelFocus.current?.()
    requested.current = section
    focusTarget.current = section && selector ? { section, selector } : null
    if (closing.current) return // Latest request wins while the previous panel exits.
    if (active.current === section) {
      if (section) focusAfterOpening(section)
      return
    }
    if (active.current) {
      const item = form.current?.querySelector<HTMLElement>(`#${active.current}`)
      if (item?.querySelector(".patient-section-panel")?.contains(document.activeElement)) {
        item.querySelector<HTMLElement>("[data-patient-section-trigger]")?.focus({ preventScroll: true })
      }
      closing.current = active.current
      setClosingSectionId(active.current)
      active.current = null
      setOpenSectionId(null)
    } else {
      active.current = section
      setOpenSectionId(section)
    }
  }, [focusAfterOpening, form])

  useLayoutEffect(() => {
    if (!closingSectionId) return
    const panel = form.current?.querySelector<HTMLElement>(`#${closingSectionId} .patient-section-panel`)
    const complete = () => {
      if (panel && !panel.hidden) return
      // Base UI hides the panel after its CSS animation finishes (also without motion).
      closing.current = null
      setClosingSectionId(null)
      active.current = requested.current
      setOpenSectionId(requested.current)
    }
    const observer = new MutationObserver(complete)
    if (panel) observer.observe(panel, { attributes: true, attributeFilter: ["hidden"] })
    complete()
    return () => observer.disconnect()
  }, [closingSectionId, form])

  useEffect(() => {
    if (openSectionId) focusAfterOpening(openSectionId)
    return () => cancelFocus.current?.()
  }, [openSectionId, focusAfterOpening])

  const onValueChange = (value: string[]) => {
    const next = value[0] ?? null
    requestSection(closing.current && next === requested.current ? null : next)
  }
  return { openSectionId, requestSection, onValueChange }
}
