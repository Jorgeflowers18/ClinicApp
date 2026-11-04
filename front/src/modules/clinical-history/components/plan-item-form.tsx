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

import {
  proposedTreatmentFormSchema,
  type ProposedTreatment,
  type ProposedTreatmentFormValues,
} from "../types/clinical-history.types"

const emptyValues: ProposedTreatmentFormValues = { treatmentId: "", tooth: "" }

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
    onAdd({ id: createId(), treatmentId: treatment.id, description: treatment.name, tooth: values.tooth.trim() })
    reset(emptyValues)
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-start"
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

      <Button type="submit" className="md:mt-6">
        <Plus />
        Agregar
      </Button>
    </form>
  )
}
