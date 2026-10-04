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
  planItemFormSchema,
  planItemStatusLabels,
  type PlanItem,
  type PlanItemFormValues,
} from "../types/clinical-history.types"

const formStatuses = ["pendiente", "en-curso", "realizado"] as const
const statusItems = Object.fromEntries(formStatuses.map((status) => [status, planItemStatusLabels[status]]))

const emptyValues: PlanItemFormValues = { treatmentId: "", tooth: "", sessions: 1, status: "pendiente" }

interface PlanItemFormProps {
  treatments: Treatment[]
  onAdd: (item: PlanItem) => void
}

/** Alta de un ítem del plan: siempre a partir del catálogo de tratamientos activos. */
export function PlanItemForm({ treatments, onAdd }: PlanItemFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlanItemFormValues>({
    resolver: zodResolver(planItemFormSchema),
    defaultValues: emptyValues,
  })

  const treatmentItems = Object.fromEntries(treatments.map((treatment) => [treatment.id, treatment.name]))

  function onSubmit(values: PlanItemFormValues) {
    const treatment = treatments.find((item) => item.id === values.treatmentId)
    if (!treatment) return
    onAdd({
      id: createId(),
      treatmentId: treatment.id,
      description: treatment.name,
      tooth: values.tooth.trim(),
      sessions: values.sessions,
      status: values.status,
      assignmentId: null,
    })
    reset(emptyValues)
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_7rem_minmax(0,1.3fr)_auto] md:items-start"
      aria-label="Agregar tratamiento al plan"
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

      <Field data-invalid={!!errors.sessions}>
        <FieldLabel htmlFor="plan-sessions">Sesiones</FieldLabel>
        <Input id="plan-sessions" type="number" min={1} max={60} aria-invalid={!!errors.sessions} {...register("sessions")} />
        <FieldError errors={errors.sessions ? [errors.sessions] : undefined} />
      </Field>

      <Field data-invalid={!!errors.status}>
        <FieldLabel htmlFor="plan-status">Estado</FieldLabel>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select items={statusItems} value={field.value} onValueChange={(value) => value && field.onChange(value)}>
              <SelectTrigger id="plan-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {planItemStatusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError errors={errors.status ? [errors.status] : undefined} />
      </Field>

      <Button type="submit" className="md:mt-6">
        <Plus />
        Agregar al plan
      </Button>
    </form>
  )
}
