import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
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
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage } from "@/shared/lib/error-message"

import { useCreateSupplier, useUpdateSupplier } from "../api/inventory.queries"
import { supplierSchema, type Supplier, type SupplierFormValues } from "../types/inventory.types"

interface SupplierFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa un proveedor, el diálogo lo edita; si no, crea uno nuevo. */
  supplier?: Supplier | null
}

const EMPTY_VALUES: SupplierFormValues = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
}

export function SupplierFormDialog({ open, onOpenChange, supplier }: SupplierFormDialogProps) {
  const isEditMode = Boolean(supplier)
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: EMPTY_VALUES,
  })

  useEffect(() => {
    if (!open) return
    reset(
      supplier
        ? {
            name: supplier.name,
            contactName: supplier.contactName ?? "",
            phone: supplier.phone ?? "",
            email: supplier.email ?? "",
            address: supplier.address ?? "",
            notes: supplier.notes ?? "",
          }
        : EMPTY_VALUES
    )
  }, [open, supplier, reset])

  async function onSubmit(values: SupplierFormValues) {
    try {
      if (supplier) {
        await updateSupplier.mutateAsync({ id: supplier.id, values })
        toast.success("Proveedor actualizado")
      } else {
        await createSupplier.mutateAsync(values)
        toast.success("Proveedor creado")
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>
            Los proveedores registrados aquí se pueden elegir al crear una orden de compra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Nombre</FieldLabel>
              <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.contactName}>
                <FieldLabel htmlFor="contactName">Persona de contacto</FieldLabel>
                <Input id="contactName" {...register("contactName")} />
              </Field>

              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
                <Input id="phone" {...register("phone")} />
              </Field>

              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
                <FieldError errors={errors.email ? [errors.email] : undefined} />
              </Field>

              <Field data-invalid={!!errors.address}>
                <FieldLabel htmlFor="address">Dirección</FieldLabel>
                <Input id="address" {...register("address")} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="notes">Notas / condiciones (opcional)</FieldLabel>
              <Textarea
                id="notes"
                rows={2}
                placeholder="Plazos de entrega, pedidos mínimos, condiciones de pago..."
                {...register("notes")}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : isEditMode ? "Guardar cambios" : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
