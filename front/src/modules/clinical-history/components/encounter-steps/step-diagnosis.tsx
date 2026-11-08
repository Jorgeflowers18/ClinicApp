import { Plus, Trash2 } from "lucide-react"
import { Controller, useFormContext, useWatch } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { formatDateOnly } from "@/shared/lib/date"
import { createId } from "@/shared/lib/id"

import { suggestedNextVisit } from "../../lib/encounter"
import { isConditionMarked, yesNoLabels } from "../../types/background.types"
import type { ClinicalRecord, EncounterFormValues } from "../../types/clinical-history.types"
import {
  maintenanceItems,
  periodontalComponents,
  priorityItems,
  prognosisItems,
  type Diagnosis,
} from "../../types/encounter-assessment.types"
import { ChoiceButtons, ChoiceField, NumberField, TextField } from "../form-controls"

/** Hallazgos del odontograma que se ofrecen como diagnóstico: caries y diagnósticos por pieza. */
function chartSuggestions(record: ClinicalRecord) {
  const sections = record.chart?.summary?.sections ?? []
  return sections
    .filter((section) => section.key === "caries" || section.key === "diagnoses")
    .flatMap((section) => section.items)
    .map((item) => ({ description: item, tooth: item.match(/\b([1-8][1-8])\b/)?.[1] ?? "" }))
}

/** Paso 4: diagnósticos, pronóstico, diagnóstico periodontal e intervalo de mantenimiento. */
export function StepDiagnosis({ record }: { record: ClinicalRecord }) {
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<EncounterFormValues>()
  const [diagnoses, date, nextVisit] = useWatch({ control, name: ["diagnoses", "date", "nextVisit"] })
  const added = new Set(diagnoses.map((item) => item.description.trim()))
  const suggestions = chartSuggestions(record).filter((item) => !added.has(item.description.trim()))
  const listError = errors.diagnoses?.root ?? (errors.diagnoses?.message ? errors.diagnoses : undefined)

  const tobacco = record.habits.tobacco
  const references = [
    tobacco.answer && `Tabaco / vapeo en la historia: ${yesNoLabels[tobacco.answer]}${tobacco.detail ? ` (${tobacco.detail})` : ""}`,
    isConditionMarked(record.medicalBackground.conditions.diabetes) && "Diabetes mellitus marcada en los antecedentes médicos",
  ].filter(Boolean)

  function addDiagnosis(item: Partial<Diagnosis> = {}) {
    setValue(
      "diagnoses",
      [...getValues("diagnoses"), { id: createId(), description: "", tooth: "", priority: "", ...item }],
      { shouldDirty: true, shouldValidate: Boolean(listError) }
    )
  }

  function chooseInterval(option: string, onChange: (value: string) => void) {
    onChange(option)
    const suggested = suggestedNextVisit(date, { option: option as EncounterFormValues["maintenanceInterval"]["option"], other: "" })
    if (suggested && !nextVisit) setValue("nextVisit", suggested, { shouldDirty: true })
  }

  return (
    <FieldGroup>
      <FieldSet>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLegend className="mb-0">Diagnósticos</FieldLegend>
          <Button type="button" size="sm" variant="outline" onClick={() => addDiagnosis()}>
            <Plus />
            Agregar diagnóstico
          </Button>
        </div>
        <FieldDescription>Diagnóstico clínico o código CIE-10, en texto libre. Se pide al menos uno.</FieldDescription>

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Hallazgos del odontograma guardado</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((item) => (
                <Button
                  key={item.description}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-auto max-w-full py-1 text-left whitespace-normal"
                  onClick={() => addDiagnosis({ description: item.description, tooth: item.tooth })}
                >
                  <Plus />
                  {item.description}
                </Button>
              ))}
            </div>
          </div>
        )}

        {diagnoses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin diagnósticos registrados.</p>
        ) : (
          <ol className="space-y-3">
            {diagnoses.map((diagnosis, index) => (
              <li
                key={diagnosis.id}
                aria-label={`Diagnóstico ${index + 1}`}
                className="grid gap-3 rounded-lg border p-3 md:grid-cols-[2rem_minmax(0,2fr)_minmax(0,1fr)_auto_auto] md:items-start"
              >
                <span className="text-sm font-medium text-muted-foreground md:pt-7">{index + 1}.</span>
                <TextField name={`diagnoses.${index}.description`} label="Diagnóstico clínico / CIE-10" />
                <TextField name={`diagnoses.${index}.tooth`} label="Pieza / región" />
                <ChoiceField name={`diagnoses.${index}.priority`} label="Prioridad" options={priorityItems} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="md:mt-6"
                  aria-label={`Quitar diagnóstico ${index + 1}`}
                  onClick={() =>
                    setValue(
                      "diagnoses",
                      diagnoses.filter((item) => item.id !== diagnosis.id),
                      { shouldDirty: true }
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
        )}
        <FieldError errors={listError ? [listError] : undefined} />
      </FieldSet>

      <FieldSet>
        <FieldLegend>Pronóstico</FieldLegend>
        <ChoiceField name="prognosis.level" label="Pronóstico" options={prognosisItems} hideLabel />
        <TextField name="prognosis.notes" label="Pronóstico general y por piezas" multiline rows={2} />
      </FieldSet>

      <FieldSet>
        <FieldLegend>Diagnóstico periodontal 2017</FieldLegend>
        <FieldDescription>Una opción por componente; todas son opcionales.</FieldDescription>
        <div className="grid gap-4 lg:grid-cols-2">
          {periodontalComponents.map((component) => (
            <ChoiceField
              key={component.name}
              name={`periodontalDiagnosis.${component.name}`}
              label={component.label}
              options={component.items}
            />
          ))}
        </div>
        <p className="text-sm font-medium">Factores modificadores</p>
        {references.length > 0 && (
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {references.map((line) => (
              <li key={String(line)}>{line}</li>
            ))}
          </ul>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <TextField name="periodontalDiagnosis.smoking" label="Tabaquismo" />
          <TextField name="periodontalDiagnosis.diabetes" label="Diabetes / HbA1c" />
          <TextField name="periodontalDiagnosis.otherFactors" label="Otros factores" />
        </div>
        <NumberField
          name="periodontalDiagnosis.teethLostToPerio"
          label="Dientes perdidos por periodontitis"
          min={0}
          max={32}
          className="md:max-w-xs"
        />
      </FieldSet>

      <FieldSet>
        <FieldLegend>Intervalo de mantenimiento</FieldLegend>
        <Controller
          control={control}
          name="maintenanceInterval.option"
          render={({ field }) => (
            <ChoiceButtons
              label="Intervalo de mantenimiento"
              options={maintenanceItems}
              value={field.value}
              onChange={(value) => chooseInterval(value, field.onChange)}
            />
          )}
        />
        <MaintenanceOther />
        {nextVisit && (
          <FieldDescription>
            Próximo control: {formatDateOnly(nextVisit, { day: "2-digit", month: "long", year: "numeric" })} (se puede
            cambiar en el paso «Tratamientos y evolución»).
          </FieldDescription>
        )}
      </FieldSet>
    </FieldGroup>
  )
}

function MaintenanceOther() {
  const { control } = useFormContext<EncounterFormValues>()
  const option = useWatch({ control, name: "maintenanceInterval.option" })
  if (option !== "otro") return null
  return <TextField name="maintenanceInterval.other" label="Otro intervalo" className="md:max-w-xs" />
}
