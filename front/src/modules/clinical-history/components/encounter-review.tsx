import { LockKeyhole, Pencil } from "lucide-react"
import { useWatch } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { formatDateOnly } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import { encounterSections, encounterSteps, type EncounterStepId } from "../lib/encounter-summary"
import { sumCosts } from "../lib/record"
import type { EncounterFormValues } from "../types/clinical-history.types"
import { EncounterSummary } from "./encounter-summary"

interface EncounterReviewProps {
  professionalName?: string
  appointmentLabel?: string
  issues: { step: number; message: string; field?: string }[]
  onEdit: (step: EncounterStepId, field?: string) => void
}

/** Read-only presentation of the live draft. No mutation, derived clinical judgment or autosave. */
export function EncounterReview({ professionalName, appointmentLabel, issues, onEdit }: EncounterReviewProps) {
  const values = useWatch() as EncounterFormValues
  const entered = encounterSections(values)
  const validCosts = values.performedTreatments.every((item) => Number.isFinite(item.cost))
  const sections = encounterSteps.slice(0, 5).map(({ id, label }) => {
    const section = entered.find((item) => item.step === id)
    const items = [...(section?.items ?? [])]
    if (id === "examen") {
      for (const [title, exam] of [["Exploraciones extraorales", values.extraoralExam], ["Exploraciones intraorales", values.intraoralExam]] as const) {
        const pending = Object.values(exam).filter((item) => item.status === "no_evaluado").length
        if (pending) items.push({ label: title, value: `${pending} sin evaluar` })
      }
    }
    if (id === "tratamientos") {
      items.push({ label: "Tratamientos realizados", value: values.performedTreatments.length
        ? [...values.performedTreatments.map((item) => `${item.description}${item.tooth ? ` (${item.tooth})` : ""} · ${Number.isFinite(item.cost) ? formatCurrency(item.cost) : "Revisa el costo"}`),
          `Total ${validCosts ? formatCurrency(sumCosts(values.performedTreatments)) : "Revisa los costos"}`]
        : "No se registran tratamientos realizados." })
    }
    return { step: id, title: section?.title ?? label, items: items.length ? items : [{ label: "Registro", value: "Sin datos registrados en este paso." }] }
  })
  return (
    <div className="clinic-encounter-review space-y-5">
      <dl className="clinic-encounter-review-identity">
        <div><dt>Fecha</dt><dd>{values.date ? formatDateOnly(values.date, { day: "2-digit", month: "long", year: "numeric" }) : "Sin fecha"}</dd></div>
        <div><dt>Profesional</dt><dd>{professionalName ?? "Sin asignar"}</dd></div>
        <div><dt>Cita</dt><dd>{values.appointmentId ? appointmentLabel ?? "Cita vinculada" : "Sin cita vinculada"}</dd></div>
      </dl>
      {issues.length > 0 && (
        <section aria-label="Campos pendientes de revisión" className="clinic-encounter-review-errors">
          <h3 className="text-sm font-semibold">Revisa estos campos antes de guardar</h3>
          <ul>
            {encounterSteps.map((item, index) => {
              const messages = [...new Set(issues.filter((issue) => issue.step === index).map((issue) => issue.message))]
              return messages.length ? <li key={item.id}>
                <Button type="button" variant="link" onClick={() => onEdit(item.id, issues.find(issue => issue.step === index)?.field)}>Revisar {item.label}</Button>
                <span>{messages.join(" · ")}</span>
              </li> : null
            })}
          </ul>
        </section>
      )}
      <EncounterSummary
        className="clinic-encounter-review-sections"
        sections={sections}
        action={(section) => <Button type="button" size="sm" variant="ghost" aria-label={`Editar ${section.title}`} onClick={() => onEdit(section.step)}><Pencil />Editar</Button>}
      />
      <p className="clinic-encounter-review-notice text-sm">
        <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
        Al confirmar, esta atención quedará registrada y no se podrá modificar. Las correcciones se agregan mediante notas aclaratorias.
      </p>
    </div>
  )
}
