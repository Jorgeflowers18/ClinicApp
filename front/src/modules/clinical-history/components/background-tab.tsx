import { Plus, Trash2 } from "lucide-react"
import { Controller, useFormContext, useWatch } from "react-hook-form"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldDescription, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createId } from "@/shared/lib/id"

import {
  bruxismPatterns,
  conditionsWithDetail,
  dentalBackgroundItems,
  hygieneAidItems,
  hygieneQualities,
  isConditionMarked,
  medicalAlertItems,
  medicalConditionItems,
  periodontalBackgroundItems,
  yesNoLabels,
  type Habits,
  type YesNo,
} from "../types/background.types"
import type { RecordFormValues } from "../types/clinical-history.types"
import { CheckboxItem, CheckboxListField, ChoiceField, NumberField, TextField } from "./form-controls"

const yesNoItems = [
  ["si", yesNoLabels.si],
  ["no", yesNoLabels.no],
] as const

const sectionIds = {
  medical: "antecedentes-medicos",
  allergies: "alergias-medicamentos",
  habits: "habitos",
  dental: "antecedentes-odontologicos",
  periodontal: "antecedentes-periodontales",
} as const

function goTo(section: keyof typeof sectionIds) {
  document.getElementById(sectionIds[section])?.scrollIntoView({ behavior: "smooth", block: "start" })
}

function MedicalBackgroundCard() {
  const {
    control,
    formState: { errors },
  } = useFormContext<RecordFormValues>()
  const background = useWatch({ control, name: "medicalBackground" })
  const deniesError = errors.medicalBackground?.denies

  return (
    <Card id={sectionIds.medical} className="scroll-mt-4">
      <CardHeader>
        <CardTitle>Antecedentes médicos personales y familiares</CardTitle>
        <CardDescription>Marca si el antecedente es personal, familiar o ambos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Controller
          control={control}
          name="medicalBackground.denies"
          render={({ field }) => (
            <div className="rounded-lg border bg-muted/30 p-3">
              <CheckboxItem
                label={<span className="font-medium">Niega antecedentes relevantes</span>}
                checked={field.value}
                invalid={!!deniesError}
                onCheckedChange={field.onChange}
              >
                <FieldDescription className="text-xs">No se puede marcar junto con otros antecedentes.</FieldDescription>
                <FieldError errors={deniesError ? [deniesError] : undefined} />
              </CheckboxItem>
            </div>
          )}
        />

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Antecedente</th>
                <th className="w-24 px-3 py-2 text-center font-medium">Personal</th>
                <th className="w-24 px-3 py-2 text-center font-medium">Familiar</th>
              </tr>
            </thead>
            <tbody>
              {medicalConditionItems.map(([key, label]) => {
                const condition = background.conditions[key]
                const needsDetail = conditionsWithDetail.includes(key) && isConditionMarked(condition)
                const detailError = errors.medicalBackground?.conditions?.[key]?.detail
                return (
                  <tr key={key} className="border-t align-top">
                    <td className="px-3 py-2">
                      <p>{label}</p>
                      {needsDetail && (
                        <div className="mt-1.5 max-w-md space-y-1">
                          <Controller
                            control={control}
                            name={`medicalBackground.conditions.${key}.detail`}
                            render={({ field }) => (
                              <Input
                                aria-label={`Detalle de ${label}`}
                                placeholder={key === "otro" ? "Describe el antecedente" : "Cuál y cuándo"}
                                aria-invalid={!!detailError}
                                {...field}
                              />
                            )}
                          />
                          <FieldError errors={detailError ? [detailError] : undefined} />
                        </div>
                      )}
                    </td>
                    {(["personal", "family"] as const).map((type) => (
                      <td key={type} className="px-3 py-2 text-center">
                        <Controller
                          control={control}
                          name={`medicalBackground.conditions.${key}.${type}`}
                          render={({ field }) => (
                            <span className="inline-flex">
                              <CheckboxItem
                                label=""
                                ariaLabel={`${label}: ${type === "personal" ? "personal" : "familiar"}`}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </span>
                          )}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function AllergiesCard() {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<RecordFormValues>()
  const [allergies, medications] = useWatch({
    control,
    name: ["allergiesAndMedication.allergies", "allergiesAndMedication.medications"],
  })

  return (
    <Card id={sectionIds.allergies} className="scroll-mt-4">
      <CardHeader>
        <CardTitle>Alergias, medicamentos y alertas</CardTitle>
        <CardDescription>
          Las alertas y alergias se muestran destacadas en el encabezado de la historia y al registrar una atención.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section aria-label="Alergias" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Alergias</h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setValue(
                  "allergiesAndMedication.allergies",
                  [...allergies, { id: createId(), reaction: "", substance: "", manifestation: "" }],
                  { shouldDirty: true }
                )
              }
            >
              <Plus />
              Agregar alergia
            </Button>
          </div>
          {allergies.length === 0 && <p className="text-sm text-muted-foreground">Sin alergias registradas.</p>}
          {allergies.map((allergy, index) => (
            <div key={allergy.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-start">
              <TextField name={`allergiesAndMedication.allergies.${index}.reaction`} label="Alergia / reacción" />
              <TextField name={`allergiesAndMedication.allergies.${index}.substance`} label="Medicamento o sustancia" />
              <TextField name={`allergiesAndMedication.allergies.${index}.manifestation`} label="Manifestación y gravedad" />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="md:mt-6"
                aria-label={`Quitar alergia ${index + 1}`}
                onClick={() =>
                  setValue(
                    "allergiesAndMedication.allergies",
                    allergies.filter((item) => item.id !== allergy.id),
                    { shouldDirty: true }
                  )
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </section>

        <section aria-label="Medicación actual" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Medicación actual</h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setValue(
                  "allergiesAndMedication.medications",
                  [...medications, { id: createId(), name: "", dose: "", indication: "" }],
                  { shouldDirty: true }
                )
              }
            >
              <Plus />
              Agregar medicamento
            </Button>
          </div>
          {medications.length === 0 && <p className="text-sm text-muted-foreground">Sin medicación registrada.</p>}
          {medications.map((medication, index) => (
            <div key={medication.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-start">
              <TextField name={`allergiesAndMedication.medications.${index}.name`} label="Medicamento actual" />
              <TextField name={`allergiesAndMedication.medications.${index}.dose`} label="Dosis / frecuencia" />
              <TextField name={`allergiesAndMedication.medications.${index}.indication`} label="Indicación / médico tratante" />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="md:mt-6"
                aria-label={`Quitar medicamento ${index + 1}`}
                onClick={() =>
                  setValue(
                    "allergiesAndMedication.medications",
                    medications.filter((item) => item.id !== medication.id),
                    { shouldDirty: true }
                  )
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </section>

        <section aria-label="Alertas" className="space-y-3">
          <h3 className="text-sm font-medium">Alertas</h3>
          <CheckboxListField name="allergiesAndMedication.alerts" options={medicalAlertItems} />
          {errors.allergiesAndMedication?.alerts && (
            <FieldError errors={[errors.allergiesAndMedication.alerts]} />
          )}
        </section>
      </CardContent>
    </Card>
  )
}

function HabitRow({ label, name, children }: { label: string; name: keyof Habits; children?: React.ReactNode }) {
  const { control } = useFormContext<RecordFormValues>()
  const answer = useWatch({ control, name: `habits.${name}.answer` }) as YesNo
  return (
    <div className="grid gap-3 border-t py-3 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,14rem)_auto_minmax(0,1fr)] md:items-start">
      <p className="text-sm font-medium md:pt-1">{label}</p>
      <ChoiceField name={`habits.${name}.answer`} label={label} options={yesNoItems} hideLabel />
      <div className="min-w-0">{answer === "si" && children}</div>
    </div>
  )
}

function HabitsCard() {
  return (
    <Card id={sectionIds.habits} className="scroll-mt-4">
      <CardHeader>
        <CardTitle>Hábitos y factores de riesgo</CardTitle>
        <CardDescription>Al marcar «Sí» se piden sus características.</CardDescription>
      </CardHeader>
      <CardContent>
        <HabitRow label="Tabaco / vapeo" name="tobacco">
          <TextField name="habits.tobacco.detail" label="Tipo, cantidad y años" />
        </HabitRow>
        <HabitRow label="Alcohol / sustancias" name="alcohol">
          <TextField name="habits.alcohol.detail" label="Tipo / frecuencia" />
        </HabitRow>
        <HabitRow label="Bruxismo / apretamiento" name="bruxism">
          <ChoiceField name="habits.bruxism.pattern" label="Momento" options={bruxismPatterns} />
        </HabitRow>
        <HabitRow label="Respiración oral" name="mouthBreathing" />
        <HabitRow label="Higiene oral" name="hygiene">
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ChoiceField name="habits.hygiene.quality" label="Calidad" options={hygieneQualities} />
              <NumberField name="habits.hygiene.brushingPerDay" label="Cepillados por día" min={0} max={10} />
            </div>
            <div className="space-y-2">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Elementos que usa
                <Badge variant="outline" className="text-xs">
                  Lista provisional
                </Badge>
              </p>
              <CheckboxListField name="habits.hygiene.aids" options={hygieneAidItems} />
            </div>
          </FieldGroup>
        </HabitRow>
        <HabitRow label="Dieta cariogénica" name="cariogenicDiet">
          <TextField name="habits.cariogenicDiet.detail" label="Frecuencia" />
        </HabitRow>
      </CardContent>
    </Card>
  )
}

function DentalBackgroundCard() {
  return (
    <Card id={sectionIds.dental} className="scroll-mt-4">
      <CardHeader>
        <CardTitle>Antecedentes odontológicos</CardTitle>
        <CardDescription>
          «Movilidad dental» y «Tratamiento periodontal» también aparecen en los antecedentes periodontales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CheckboxListField name="dentalBackground.items" options={dentalBackgroundItems} columns={3} />
        <TextField
          name="dentalBackground.notes"
          label="Última consulta, tratamientos realizados y observaciones"
          multiline
          rows={3}
        />
      </CardContent>
    </Card>
  )
}

const answerText = (answer: YesNo) => (answer ? yesNoLabels[answer] : "Sin registrar")

function PeriodontalBackgroundCard() {
  const { control } = useFormContext<RecordFormValues>()
  const [dental, conditions, habits] = useWatch({
    control,
    name: ["dentalBackground.items", "medicalBackground.conditions", "habits"],
  })
  const repeated = [
    { label: "Movilidad", value: dental.includes("movilidad") ? "Sí" : "No", section: "dental", sectionLabel: "Antecedentes odontológicos" },
    {
      label: "Tratamiento periodontal previo",
      value: dental.includes("tratamiento_periodontal") ? "Sí" : "No",
      section: "dental",
      sectionLabel: "Antecedentes odontológicos",
    },
    { label: "Tabaquismo / vapeo", value: answerText(habits.tobacco.answer), section: "habits", sectionLabel: "Hábitos" },
    {
      label: "Diabetes / HbA1c elevada",
      value: isConditionMarked(conditions.diabetes) ? "Sí" : "No",
      section: "medical",
      sectionLabel: "Antecedentes médicos",
    },
    {
      label: "Higiene deficiente",
      value: habits.hygiene.quality === "deficiente" ? "Sí" : habits.hygiene.quality ? "No" : "Sin registrar",
      section: "habits",
      sectionLabel: "Hábitos",
    },
  ] as const

  return (
    <Card id={sectionIds.periodontal} className="scroll-mt-4">
      <CardHeader>
        <CardTitle>Antecedentes y síntomas periodontales</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CheckboxListField name="periodontalBackground.items" options={periodontalBackgroundItems} columns={3} />
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Ya registrado en otras secciones</p>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {repeated.map((item) => (
              <li key={item.label} className="flex flex-wrap items-baseline gap-x-1.5">
                <span>{item.label}:</span>
                <span className="font-medium">{item.value}</span>
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => goTo(item.section)}
                >
                  ya registrado en {item.sectionLabel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

/** Antecedentes del paciente (formulario en papel, secciones 3 a 6 y 18). Se guardan con «Guardar cambios». */
export function BackgroundTab() {
  return (
    <div className="space-y-4">
      <MedicalBackgroundCard />
      <AllergiesCard />
      <HabitsCard />
      <DentalBackgroundCard />
      <PeriodontalBackgroundCard />
    </div>
  )
}
