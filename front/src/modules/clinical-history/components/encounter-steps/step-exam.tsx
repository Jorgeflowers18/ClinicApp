import { CheckCheck } from "lucide-react"
import { Controller, useFormContext, useWatch } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import type { EncounterFormValues } from "../../types/clinical-history.types"
import {
  examStatusItems,
  extraoralItems,
  intraoralItems,
  riskLevelItems,
  type ExamFinding,
} from "../../types/encounter-assessment.types"
import { ChoiceButtons, ChoiceField, NumberField, TextField } from "../form-controls"

type ExamName = "extraoralExam" | "intraoralExam"

function ExamSection({
  name,
  title,
  items,
}: {
  name: ExamName
  title: string
  items: readonly (readonly [string, string])[]
}) {
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<EncounterFormValues>()
  const exam = useWatch({ control, name }) as Record<string, ExamFinding>

  function markAllNormal() {
    const current = getValues(name) as Record<string, ExamFinding>
    const next = Object.fromEntries(Object.entries(current).map(([key, item]) => [key, { ...item, status: "normal" }]))
    setValue(name, next as EncounterFormValues[ExamName], { shouldDirty: true, shouldValidate: Boolean(errors[name]) })
  }

  return (
    <FieldSet>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLegend className="mb-0">{title}</FieldLegend>
        <Button type="button" size="sm" variant="outline" onClick={markAllNormal} aria-label={`Marcar todo como normal: ${title}`}>
          <CheckCheck />
          Marcar todo como normal
        </Button>
      </div>
      <div className="clinic-encounter-exams">
        {items.map(([key, label]) => {
          const item = exam[key]
          const error = (errors[name] as Record<string, { finding?: { message?: string } }> | undefined)?.[key]?.finding
          return (
            <div key={key} className="clinic-encounter-exam">
              <p className="text-sm font-medium">{label}</p>
              <Controller
                control={control}
                name={`${name}.${key}.status` as `extraoralExam.simetria.status`}
                render={({ field }) => (
                  <ChoiceButtons
                    label={label}
                    options={examStatusItems}
                    value={field.value}
                    allowClear={false}
                    tone="exam"
                    onChange={field.onChange}
                  />
                )}
              />
              {item?.status === "alterado" ? (
                <div className="space-y-1">
                  <Controller
                    control={control}
                    name={`${name}.${key}.finding` as `extraoralExam.simetria.finding`}
                    render={({ field }) => (
                      <Input aria-label={`Hallazgo de ${label}`} placeholder="Hallazgo" aria-invalid={!!error} {...field} />
                    )}
                  />
                  <FieldError errors={error ? [error] : undefined} />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </FieldSet>
  )
}

import { EncounterAccordion } from "../encounter-accordion"

/** Paso 3: exámenes extraoral e intraoral, dolor y riesgos de caries y periodontal. */
export function StepExam() {
  return (
    <EncounterAccordion step="examen" items={[
      {
        id: "extraoral", title: "Examen extraoral", fields: ["extraoralExam"], children: (
          <ExamSection name="extraoralExam" title="Examen extraoral" items={extraoralItems} />
        )
      },
      {
        id: "intraoral", title: "Examen intraoral", fields: ["intraoralExam"], children: (
          <ExamSection name="intraoralExam" title="Examen intraoral" items={intraoralItems} />
        )
      },
      {
        id: "pain", title: "Evaluación del dolor", fields: ["pain"], children: (
          <FieldSet>
            <FieldLegend>Evaluación de dolor</FieldLegend>
            <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
              <NumberField name="pain.scale" label="Dolor EVA" unit="0 a 10" min={0} max={10} />
              <TextField name="pain.location" label="Localización" />
              <TextField name="pain.character" label="Tipo / duración / irradiación" />
            </div>
          </FieldSet>
        )
      },
      {
        id: "risks", title: "Riesgo de caries y periodontal", fields: ["cariesRisk", "periodontalRisk"], children: (
          <div className="grid gap-6 md:grid-cols-2">
            <FieldSet>
              <FieldLegend>Riesgo de caries</FieldLegend>
              <ChoiceField name="cariesRisk.level" label="Nivel de riesgo de caries" options={riskLevelItems} tone="risk" hideLabel />
              <TextField name="cariesRisk.factors" label="Factores (caries)" />
            </FieldSet>
            <FieldSet>
              <FieldLegend>Riesgo periodontal</FieldLegend>
              <ChoiceField name="periodontalRisk.level" label="Nivel de riesgo periodontal" options={riskLevelItems} tone="risk" hideLabel />
              <TextField name="periodontalRisk.factors" label="Factores (periodontal)" />
            </FieldSet>
          </div>

        )
      },
    ]} />
  )
}
