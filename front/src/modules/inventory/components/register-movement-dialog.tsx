import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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

import { useRegisterMovement } from "../api/inventory.queries"
import { movementSchema, type MovementFormValues } from "../types/inventory.types"

interface RegisterMovementDialogProps {
  itemId: string
  itemName: string
  currentStock: number
  unit: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RegisterMovementDialog({
  itemId,
  itemName,
  currentStock,
  unit,
  open,
  onOpenChange,
}: RegisterMovementDialogProps) {
  const registerMovement = useRegisterMovement(itemId)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: { type: "entrada", quantity: 1, reason: "" },
  })

  async function onSubmit(values: MovementFormValues) {
    try {
      await registerMovement.mutateAsync(values)
      toast.success("Movimiento registrado")
      reset({ type: "entrada", quantity: 1, reason: "" })
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>
            {itemName} · Stock actual: {currentStock} {unit}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field data-invalid={!!errors.type}>
              <FieldLabel htmlFor="type">Tipo de movimiento</FieldLabel>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="type" className="w-full">
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="salida">Salida</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.type ? [errors.type] : undefined} />
            </Field>

            <Field data-invalid={!!errors.quantity}>
              <FieldLabel htmlFor="quantity">Cantidad</FieldLabel>
              <Input id="quantity" type="number" min={1} aria-invalid={!!errors.quantity} {...register("quantity")} />
              <FieldError errors={errors.quantity ? [errors.quantity] : undefined} />
            </Field>

            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="reason">Motivo</FieldLabel>
              <Textarea
                id="reason"
                rows={2}
                placeholder="Ej. Compra a proveedor, uso en tratamiento..."
                aria-invalid={!!errors.reason}
                {...register("reason")}
              />
              <FieldError errors={errors.reason ? [errors.reason] : undefined} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
