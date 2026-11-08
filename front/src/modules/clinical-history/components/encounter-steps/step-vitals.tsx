import { useFormContext, useWatch } from "react-hook-form"

import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { createId } from "@/shared/lib/id"

import type { EncounterFormValues } from "../../types/clinical-history.types"
import { asaItems, bodyMassIndex, riskItems } from "../../types/encounter-assessment.types"
import { CheckboxItem, CheckboxListField, ChoiceField, NumberField, TextField } from "../form-controls"

/** Paso 2: signos vitales, clasificación ASA y evaluación de riesgo. */
export function StepVitals() {
  const { control, getValues, setValue } = useFormContext<EncounterFormValues>()
  const [weight, height, requestedExams] = useWatch({
    control,
    name: ["vitals.weight", "vitals.height", "requestedExams"],
  })
  const bmi = bodyMassIndex({ weight, height })
  const interconsultationIndex = requestedExams.findIndex((exam) => exam.kind === "interconsulta")

  /** «Interconsulta requerida» es el examen solicitado «Interconsulta médica» (mismo elemento del papel). */
  function toggleInterconsultation(checked: boolean) {
    const current = getValues("requestedExams")
    setValue(
      "requestedExams",
      checked
        ? [...current, { id: createId(), kind: "interconsulta", detail: "" }]
        : current.filter((exam) => exam.kind !== "interconsulta"),
      { shouldDirty: true }
    )
  }

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend>Signos vitales</FieldLegend>
        <FieldDescription>Todos son opcionales.</FieldDescription>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField name="vitals.bloodPressure" label="PA (mmHg)" placeholder="120/80" />
          <NumberField name="vitals.heartRate" label="FC" unit="lpm" />
          <NumberField name="vitals.respiratoryRate" label="FR" unit="rpm" />
          <NumberField name="vitals.spo2" label="SpO₂" unit="%" />
          <NumberField name="vitals.temperature" label="Temperatura" unit="°C" step="0.1" />
          <NumberField name="vitals.weight" label="Peso" unit="kg" step="0.1" />
          <NumberField name="vitals.height" label="Talla" unit="cm" step="0.1" />
          <div className="space-y-1">
            <p className="text-sm font-medium">IMC</p>
            <p className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-sm" aria-label="IMC calculado">
              {bmi ?? "—"}
            </p>
          </div>
        </div>
      </FieldSet>

      <ChoiceField name="asa" label="Clasificación ASA" options={asaItems} />

      <FieldSet>
        <FieldLegend>Evaluación de riesgo para la atención o cirugía</FieldLegend>
        <CheckboxListField name="riskAssessment" options={riskItems} />
        <CheckboxItem
          label="Interconsulta requerida"
          checked={interconsultationIndex >= 0}
          onCheckedChange={toggleInterconsultation}
        >
          {interconsultationIndex >= 0 && (
            <div className="max-w-md">
              <TextField
                name={`requestedExams.${interconsultationIndex}.detail`}
                label="Especialista o motivo de la interconsulta"
              />
              <FieldDescription className="text-xs">
                Queda como examen solicitado «Interconsulta médica» y aparece como pendiente en la historia.
              </FieldDescription>
            </div>
          )}
        </CheckboxItem>
      </FieldSet>
    </FieldGroup>
  )
}
