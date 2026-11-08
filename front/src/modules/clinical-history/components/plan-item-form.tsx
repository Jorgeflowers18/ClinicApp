import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { Controller, useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/shared/lib/number"
import { createId } from "@/shared/lib/id"
import type { Treatment } from "@/modules/treatments/types/treatment.types"

import { NO_PHASE, phaseItems } from "../lib/plan"
import {
  proposedTreatmentFormSchema,
  today,
  type ProposedTreatment,
  type ProposedTreatmentFormValues,
} from "../types/clinical-history.types"

const emptyValues: ProposedTreatmentFormValues = { treatmentId: "", tooth: "", phase: "", plannedDate: "" }

interface PlanItemFormProps {
  treatments: Treatment[]
  onAdd: (item: ProposedTreatment) => void
}

/** Alta de un tratamiento propuesto: siempre a partir del catálogo de tratamientos activos. */
export function PlanItemForm({ treatments, onAdd }: PlanItemFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProposedTreatmentFormValues>({
    resolver: zodResolver(proposedTreatmentFormSchema),
    defaultValues: emptyValues,
  })

  const treatmentItems = Object.fromEntries(treatments.map((treatment) => [treatment.id, treatment.name]))

  function onSubmit(values: ProposedTreatmentFormValues) {
    const treatment = treatments.find((item) => item.id === values.treatmentId)
    if (!treatment) return
    onAdd({
      id: createId(),
      treatmentId: treatment.id,
      description: treatment.name,
      tooth: values.tooth.trim(),
      phase: values.phase,
      plannedDate: values.plannedDate,
    })
    reset(emptyValues)
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto] xl:items-start"
      aria-label="Agregar tratamiento propuesto"
    >
      <Field data-invalid={!!errors.treatmentId}>
        <FieldLabel htmlFor="plan-treatment">Tratamiento del catálogo</FieldLabel>
        <Controller
          control={control}
          name="treatmentId"
          render={({ field }) => (
            <Select items={treatmentItems} value={field.value || null} onValueChange={(value) => field.onChange(value ?? "")}>
              <SelectTrigger id="plan-treatment" className="w-full" aria-invalid={!!errors.treatmentId}>
                <SelectValue placeholder="Selecciona un tratamiento..." />
              </SelectTrigger>
              <SelectContent>
                {treatments.map((treatment) => (
                  <SelectItem key={treatment.id} value={treatment.id}>
                    {treatment.name} · {formatCurrency(treatment.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError errors={errors.treatmentId ? [errors.treatmentId] : undefined} />
      </Field>

      <Field data-invalid={!!errors.tooth}>
        <FieldLabel htmlFor="plan-tooth">Pieza / zona</FieldLabel>
        <Input id="plan-tooth" placeholder="Ej. 36 o arcada superior" aria-invalid={!!errors.tooth} {...register("tooth")} />
        <FieldError errors={errors.tooth ? [errors.tooth] : undefined} />
      </Field>

      <Field>
        <FieldLabel htmlFor="plan-phase">Fase</FieldLabel>
        <Controller
          control={control}
          name="phase"
          render={({ field }) => (
            <Select
              items={phaseItems}
              value={field.value || NO_PHASE}
              onValueChange={(value) => field.onChange(!value || value === NO_PHASE ? "" : value)}
            >
              <SelectTrigger id="plan-phase" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(phaseItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <Field data-invalid={!!errors.plannedDate}>
        <FieldLabel htmlFor="plan-date">Fecha prevista</FieldLabel>
        <Input id="plan-date" type="date" min={today()} aria-invalid={!!errors.plannedDate} {...register("plannedDate")} />
        <FieldError errors={errors.plannedDate ? [errors.plannedDate] : undefined} />
      </Field>

      <Button type="submit" className="xl:mt-6">
        <Plus />
        Agregar
      </Button>
    </form>
  )
}
