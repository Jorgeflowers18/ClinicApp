import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { Accordion } from "@base-ui/react/accordion"
import { ChevronDown, CircleAlert } from "lucide-react"
import { get, useFormContext } from "react-hook-form"
import type { EncounterStepId } from "../lib/encounter-summary"
import { EncounterRevealContext } from "./encounter-reveal-context"
import "./encounter-accordion.css"

interface EncounterGroup {
  id: string
  title: string
  fields: readonly string[]
  children: ReactNode
}

/** Exclusive groups only for encounter steps 2–5. All panels remain mounted. */
export function EncounterAccordion({ step, items }: { step: EncounterStepId; items: EncounterGroup[] }) {
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null)
  const [closing, setClosing] = useState<string | null>(null)
  const active = useRef(open)
  const exiting = useRef<string | null>(null)
  const requested = useRef(open)
  const focusField = useRef<string | null>(null)
  const reveal = useContext(EncounterRevealContext)
  const { formState: { errors } } = useFormContext()
  const groups = useRef(items.map(({ id, fields }) => ({ id, fields })))

  const requestGroup = useCallback((next: string | null) => {
    requested.current = next
    if (exiting.current || active.current === next) return
    if (active.current) {
      const item = root.current?.querySelector<HTMLElement>(`[data-encounter-group="${active.current}"]`)
      if (item?.querySelector(".clinic-encounter-group-panel")?.contains(document.activeElement)) {
        item.querySelector<HTMLElement>(".clinic-encounter-group-trigger")?.focus({ preventScroll: true })
      }
      exiting.current = active.current
      setClosing(active.current)
      active.current = null
      setOpen(null)
    } else {
      active.current = next
      setOpen(next)
    }
  }, [])

  useLayoutEffect(() => {
    if (!closing) return
    const panel = root.current?.querySelector<HTMLElement>(`[data-encounter-group="${closing}"] .clinic-encounter-group-panel`)
    const complete = () => {
      if (panel && !panel.hidden) return
      exiting.current = null
      active.current = requested.current
      setClosing(null)
      setOpen(requested.current)
    }
    const observer = new MutationObserver(complete)
    if (panel) observer.observe(panel, { attributes: true, attributeFilter: ["hidden"] })
    complete()
    return () => observer.disconnect()
  }, [closing])

  useEffect(() => {
    if (!reveal || reveal.step !== step) return
    const item = groups.current.find(item => item.fields.some(field => reveal.field === field || reveal.field.startsWith(`${field}.`)))
    if (!item) return
    focusField.current = reveal.field
    requestGroup(item.id)
  }, [reveal, step, requestGroup])

  useEffect(() => {
    if (!open || closing || exiting.current || open !== requested.current || !focusField.current) return
    let cancelled = false
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const panel = root.current?.querySelector<HTMLElement>(`[data-encounter-group="${open}"] .clinic-encounter-group-panel`)
        if (!panel) return
        void Promise.allSettled(panel.getAnimations().map(animation => animation.finished)).then(() => {
          if (cancelled || panel.hidden || !focusField.current) return
          const field = panel.querySelector<HTMLElement>(`[name="${CSS.escape(focusField.current)}"]`)
            ?? panel.querySelector<HTMLElement>('[aria-invalid="true"]:is(input,textarea,button,[role="combobox"]), [aria-invalid="true"] [role="radio"]')
            ?? panel.querySelector<HTMLElement>('input:not([aria-hidden="true"]),textarea,button')
          focusField.current = null
          field?.focus({ preventScroll: true })
          const scroll = root.current?.closest<HTMLElement>(".clinic-encounter-scroll")
          if (!field || !scroll) return
          const bounds = scroll.getBoundingClientRect(), box = field.getBoundingClientRect()
          const offset = box.top < bounds.top + 12 ? box.top - bounds.top - 12
            : box.bottom > bounds.bottom - 12 ? box.bottom - bounds.bottom + 12 : 0
          if (offset) scroll.scrollTo({ top: scroll.scrollTop + offset, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
        })
      })
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [open, closing, reveal])

  return (
    <Accordion.Root ref={root} className="clinic-encounter-groups" multiple={false} keepMounted value={open ? [open] : []}
      onValueChange={(values) => {
        const next = values[0] ?? null
        focusField.current = null
        requestGroup(exiting.current && next === requested.current ? null : next)
      }}>
      {items.map(item => {
        const invalid = item.fields.some(field => Boolean(get(errors, field)))
        return <Accordion.Item key={item.id} value={item.id} className="clinic-encounter-group" data-encounter-group={item.id}>
          <Accordion.Header className="clinic-encounter-group-heading">
            <Accordion.Trigger className="clinic-encounter-group-trigger">
              <span>{item.title}</span>
              {invalid && <span className="clinic-encounter-group-error"><CircleAlert aria-hidden="true" />Revisar</span>}
              <ChevronDown className="clinic-encounter-group-chevron" aria-hidden="true" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel keepMounted className="clinic-encounter-group-panel"
            render={(props, state) => <div {...props} inert={!state.open} aria-hidden={!state.open || undefined} />}>
            <div className="clinic-encounter-group-content">{item.children}</div>
          </Accordion.Panel>
        </Accordion.Item>
      })}
    </Accordion.Root>
  )
}
