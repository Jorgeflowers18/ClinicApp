import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { useCreateSterilizationCycle, useInventoryList } from "../api/inventory.queries"
import {
  sterilizationCycleSchema,
  sterilizationResultLabels,
  sterilizationResults,
  type SterilizationCycleFormValues,
} from "../types/inventory.types"

interface SterilizationCycleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SterilizationCycleFormDialog({ open, onOpenChange }: SterilizationCycleFormDialogProps) {
  const { data: inventoryPage } = useInventoryList({ page: 1, pageSize: 100 })
  const instrumentalItems = (inventoryPage?.items ?? []).filter((item) => item.kind === "instrumental")
  const { data: professionals } = useProfessionals()
  const createCycle = useCreateSterilizationCycle()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SterilizationCycleFormValues>({
    resolver: zodResolver(sterilizationCycleSchema),
    defaultValues: {
      itemIds: [],
      performedAt: new Date().toISOString().slice(0, 10),
      result: "aprobado",
      responsibleProfessionalId: "",
      notes: "",
    },
  })

  async function onSubmit(values: SterilizationCycleFormValues) {
    try {
      await createCycle.mutateAsync(values)
      toast.success("Ciclo de esterilización registrado")
      reset({
        itemIds: [],
        performedAt: new Date().toISOString().slice(0, 10),
        result: "aprobado",
        responsibleProfessionalId: "",
        notes: "",
      })
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo ciclo de esterilización</DialogTitle>
          <DialogDescription>Registra qué instrumental se esterilizó y el resultado del ciclo.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field data-invalid={!!errors.itemIds}>
              <FieldLabel>Instrumental</FieldLabel>
              {instrumentalItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay insumos marcados como instrumental esterilizable. Márcalos desde el formulario de insumo.
                </p>
              ) : (
                <Controller
                  control={control}
                  name="itemIds"
                  render={({ field }) => (
                    <div className="space-y-2 rounded-lg border p-3">
                      {instrumentalItems.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={field.value.includes(item.id)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked
                                  ? [...field.value, item.id]
                                  : field.value.filter((id) => id !== item.id)
                              )
                            }
                          />
                          {item.name}
                        </label>
                      ))}
                    </div>
                  )}
                />
              )}
              <FieldError errors={errors.itemIds ? [errors.itemIds] : undefined} />
            </Field>

            <Field data-invalid={!!errors.performedAt}>
              <FieldLabel htmlFor="performedAt">Fecha</FieldLabel>
              <Input id="performedAt" type="date" aria-invalid={!!errors.performedAt} {...register("performedAt")} />
              <FieldError errors={errors.performedAt ? [errors.performedAt] : undefined} />
            </Field>

            <Field data-invalid={!!errors.result}>
              <FieldLabel htmlFor="result">Resultado</FieldLabel>
              <Controller
                control={control}
                name="result"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="result" className="w-full">
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sterilizationResults.map((result) => (
                        <SelectItem key={result} value={result}>
                          {sterilizationResultLabels[result]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.result ? [errors.result] : undefined} />
            </Field>

            <Field data-invalid={!!errors.responsibleProfessionalId}>
              <FieldLabel htmlFor="responsibleProfessionalId">Responsable</FieldLabel>
              <Controller
                control={control}
                name="responsibleProfessionalId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="responsibleProfessionalId" className="w-full">
                      <SelectValue placeholder="Selecciona un profesional..." />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals?.map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>
                          {professional.name} · {professional.specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.responsibleProfessionalId ? [errors.responsibleProfessionalId] : undefined} />
            </Field>

            <Field>
              <FieldLabel htmlFor="notes">Notas (opcional)</FieldLabel>
              <Textarea id="notes" rows={2} {...register("notes")} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Registrar ciclo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
