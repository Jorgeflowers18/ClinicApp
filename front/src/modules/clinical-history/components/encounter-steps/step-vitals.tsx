import { useFormContext, useWatch } from "react-hook-form"

import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import { createId } from "@/shared/lib/id"

import type { EncounterFormValues } from "../../types/clinical-history.types"
import { asaItems, bodyMassIndex, riskItems } from "../../types/encounter-assessment.types"
import { CheckboxItem, CheckboxListField, ChoiceField, NumberField, TextField } from "../form-controls"

import { EncounterAccordion } from "../encounter-accordion"

/** Paso 2. El detalle compartido con el paso 5 solo registra un input a la vez. */
export function StepVitals({ active }: { active: boolean }) {
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
    <EncounterAccordion step="signos" items={[
      {
        id: "vitals", title: "Signos vitales", fields: ["vitals"], children: (
          <FieldSet>
            <FieldLegend>Signos vitales</FieldLegend>
            <FieldDescription>Todos son opcionales.</FieldDescription>
            <div className="clinic-encounter-vitals">
              <TextField name="vitals.bloodPressure" label="PA (mmHg)" />
              <NumberField name="vitals.heartRate" label="FC" unit="lpm" />
              <NumberField name="vitals.respiratoryRate" label="FR" unit="rpm" />
              <NumberField name="vitals.spo2" label="SpO₂" unit="%" />
              <NumberField name="vitals.temperature" label="Temperatura" unit="°C" step="0.1" />
              <NumberField name="vitals.weight" label="Peso" unit="kg" step="0.1" />
              <NumberField name="vitals.height" label="Talla" unit="cm" step="0.1" />
              <div className="space-y-1">
                <p className="text-sm font-medium">IMC</p>
                <p className="clinic-encounter-bmi text-sm" aria-label="IMC calculado">
                  {bmi ?? "—"}
                </p>
              </div>
            </div>
          </FieldSet>
        )
      },
      {
        id: "asa", title: "Clasificación ASA", fields: ["asa"], children: (
          <ChoiceField name="asa" label="Clasificación ASA" options={asaItems} hideLabel />
        )
      },
      {
        id: "risk", title: "Evaluación de riesgo para la atención o cirugía", fields: ["riskAssessment", "requestedExams"], children: (
          <FieldSet>
            <FieldLegend>Evaluación de riesgo para la atención o cirugía</FieldLegend>
            <div className="clinic-encounter-risk">
              <CheckboxListField name="riskAssessment" options={riskItems} className="clinic-encounter-risk-items" />
              <CheckboxItem
                label="Interconsulta requerida"
                checked={interconsultationIndex >= 0}
                onCheckedChange={toggleInterconsultation}
              >
                {active && interconsultationIndex >= 0 && (
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
            </div>
          </FieldSet>
        )
      },
    ]} />
  )
}
