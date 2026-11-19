import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createId } from "@/shared/lib/id"

import type { EncounterFormValues, ProposedTreatment } from "../../types/clinical-history.types"
import { examKindItems, examKindLabels, type ExamKind } from "../../types/encounter-assessment.types"
import { TextField } from "../form-controls"
import { PerformedTreatmentsField } from "../performed-treatments-field"
import { EncounterAccordion } from "../encounter-accordion"

const examItems = Object.fromEntries(examKindItems)

function RequestedExamsField({ active }: { active: boolean }) {
  const { control, setValue } = useFormContext<EncounterFormValues>()
  const exams = useWatch({ control, name: "requestedExams" })
  const [kind, setKind] = useState<ExamKind | "">("")
  const [detail, setDetail] = useState("")

  function add() {
    if (!kind) return
    setValue("requestedExams", [...exams, { id: createId(), kind, detail: detail.trim() }], { shouldDirty: true })
    setKind("")
    setDetail("")
  }

  return (
    <FieldSet>
      <FieldLegend>Exámenes solicitados</FieldLegend>
      <FieldDescription>
        Al guardar la atención quedan como pendientes en la historia («Fotos y documentos»), donde se sube el resultado.
      </FieldDescription>
      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-end">
        <Field>
          <FieldLabel htmlFor="requested-exam-kind">Examen</FieldLabel>
          <Select items={examItems} value={kind || null} onValueChange={(value) => setKind((value as ExamKind) ?? "")}>
            <SelectTrigger id="requested-exam-kind" className="w-full">
              <SelectValue placeholder="Selecciona un examen..." />
            </SelectTrigger>
            <SelectContent>
              {examKindItems.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="requested-exam-detail">Detalle (opcional)</FieldLabel>
          <Input
            id="requested-exam-detail"
            placeholder="Pieza, zona, especialista…"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
          />
        </Field>
        <Button type="button" variant="outline" disabled={!kind} onClick={add}>
          <Plus />
          Solicitar
        </Button>
      </div>
      {exams.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {exams.map((exam, index) => (
            <li key={exam.id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{examKindLabels[exam.kind]}</p>
                {active && <TextField name={`requestedExams.${index}.detail`} label={`Detalle de ${examKindLabels[exam.kind]}`} />}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Quitar ${examKindLabels[exam.kind]}`}
                onClick={() =>
                  setValue(
                    "requestedExams",
                    exams.filter((item) => item.id !== exam.id),
                    { shouldDirty: true }
                  )
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </FieldSet>
  )
}

/** Paso 5: procedimientos, tratamientos realizados, materiales, exámenes solicitados y evolución. */
export function StepTreatments({ proposed, active }: { proposed: ProposedTreatment[]; active: boolean }) {
  return (
    <EncounterAccordion step="tratamientos" items={[
      {
        id: "procedures", title: "Procedimientos realizados", fields: ["procedures"], children: (

          <TextField
            name="procedures"
            label="Procedimientos realizados"
            placeholder="Procedimientos ejecutados en esta atención"
            multiline
            rows={3}
          />

        )
      },
      {
        id: "performed", title: "Tratamientos realizados", fields: ["performedTreatments"], children: (
          <PerformedTreatmentsField proposed={proposed} />
        )
      },
      {
        id: "materials", title: "Materiales y anestesia", fields: ["materials"], children: (
          <TextField name="materials" label="Materiales / anestesia / lote" multiline rows={2} />
        )
      },
      {
        id: "exams", title: "Exámenes solicitados", fields: ["requestedExams"], children: (
          <RequestedExamsField active={active} />
        )
      },
      {
        id: "evolution", title: "Evolución e indicaciones", fields: ["examFindings", "evolution", "notes", "nextVisit"], children: (
          <FieldGroup>
            <TextField name="examFindings" label="Hallazgos relevantes de los exámenes" multiline rows={2} />
            <TextField
              name="evolution"
              label="Evolución / indicaciones"
              placeholder="Evolución respecto a la atención anterior e indicaciones"
              multiline
              rows={3}
            />
            <TextField name="notes" label="Observaciones" placeholder="Observaciones internas del profesional" multiline rows={2} />
            <TextField name="nextVisit" label="Próximo control" type="date" className="md:max-w-xs" />

          </FieldGroup>
        )
      },
    ]} />
  )
}
