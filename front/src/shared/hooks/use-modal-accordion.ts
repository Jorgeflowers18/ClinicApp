import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { scrollToValidationTarget, validationTarget } from "@/shared/lib/validation-focus"

interface AccordionOptions {
  item: (id: string) => string
  panel: string
  trigger: string
}
const defaultOptions: AccordionOptions = {
  item: id => `[data-modal-section="${CSS.escape(id)}"]`,
  panel: "[data-validation-panel]",
  trigger: "[data-modal-section-trigger]",
}

/** One controlled section; close and open together, retaining mounted field values. */
export function useModalAccordion(root: RefObject<HTMLElement | null>, initial: string | null, options = defaultOptions) {
  const [open, setOpen] = useState(initial)
  const [revision, setRevision] = useState(0)
  const active = useRef(initial)
  const scope = useRef(root)
  const pending = useRef<{ id: string | null; selector?: string } | null>(null)
  const { item, panel, trigger } = options

  const request = useCallback((id: string | null, selector?: string) => {
    const previous = active.current
    if (previous && previous !== id) {
      const section = scope.current.current?.querySelector<HTMLElement>(item(previous))
      if (section?.querySelector(panel)?.contains(document.activeElement)) {
        section.querySelector<HTMLElement>(trigger)?.focus({ preventScroll: true })
      }
    }
    pending.current = { id, selector }
    active.current = id
    setOpen(id)
    setRevision(value => value + 1)
  }, [item, panel, trigger])

  useEffect(() => {
    let cancelled = false
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const request = pending.current
        if (!request?.id || request.id !== open) return
        const section = root.current?.querySelector<HTMLElement>(item(request.id))
        if (!section) return
        const animations = [...(root.current?.querySelectorAll<HTMLElement>(panel) ?? [])]
          .flatMap(element => element.getAnimations())
        void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
          if (cancelled || active.current !== request.id || pending.current !== request) return
          const content = section.querySelector<HTMLElement>(panel)
          if (content?.hidden || content?.closest("[inert]")) return
          if (request.selector) {
            const target = content?.querySelector<HTMLElement>(request.selector)
              ?? (content ? validationTarget(content) : null)
            if (target) scrollToValidationTarget(target)
          } else {
            const heading = section.querySelector<HTMLElement>(trigger)
            // Keep the selected heading visible, using only the modal's own scroller.
            if (heading && document.activeElement === heading && heading.closest('[role="dialog"]')) scrollToValidationTarget(heading)
          }
          pending.current = null
        })
      })
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [open, revision, root, item, panel, trigger])

  const onValueChange = (values: string[]) => request(values[0] ?? null)
  return { open, request, onValueChange }
}
