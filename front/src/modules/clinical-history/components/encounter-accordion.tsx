import { useContext, useEffect, useRef, type ReactNode } from "react"
import { Accordion } from "@base-ui/react/accordion"
import { ChevronDown, CircleAlert } from "lucide-react"
import { get, useFormContext } from "react-hook-form"
import { useModalAccordion } from "@/shared/hooks/use-modal-accordion"
import type { EncounterStepId } from "../lib/encounter-summary"
import { EncounterRevealContext } from "./encounter-reveal-context"
import "./encounter-accordion.css"

interface EncounterGroup { id: string; title: string; fields: readonly string[]; children: ReactNode }
const options = {
  item: (id: string) => `[data-encounter-group="${CSS.escape(id)}"]`,
  panel: ".clinic-encounter-group-panel",
  trigger: ".clinic-encounter-group-trigger",
}
/** The clinical fields remain mounted and keep their original data and validation. */
export function EncounterAccordion({ step, items }: { step: EncounterStepId; items: EncounterGroup[] }) {
  const root = useRef<HTMLDivElement>(null)
  const accordion = useModalAccordion(root, items[0]?.id ?? null, options)
  const reveal = useContext(EncounterRevealContext)
  const { formState: { errors } } = useFormContext()
  const groups = useRef(items.map(({ id, fields }) => ({ id, fields })))
  const request = accordion.request
  useEffect(() => {
    if (!reveal || reveal.step !== step) return
    const group = groups.current.find(item => item.fields.some(field => reveal.field === field || reveal.field.startsWith(`${field}.`)))
    if (group) request(group.id, `[name="${CSS.escape(reveal.field)}"],[data-validation-field="${CSS.escape(reveal.field)}"]`)
  }, [reveal, step, request])
  return (
    <Accordion.Root ref={root} className="clinic-encounter-groups" multiple={false} keepMounted
      value={accordion.open ? [accordion.open] : []} onValueChange={accordion.onValueChange}>
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
