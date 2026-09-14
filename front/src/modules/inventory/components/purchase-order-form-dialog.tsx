import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useInventoryList } from "@/modules/inventory/api/inventory.queries"

import { useCreatePurchaseOrder, useSuppliersList } from "../api/inventory.queries"
import {
  purchaseOrderSchema,
  purchaseOrderStatusLabels,
  type PurchaseOrder,
  type PurchaseOrderFormValues,
  type PurchaseOrderStatus,
} from "../types/inventory.types"

interface PurchaseOrderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa una orden, el diálogo muestra su detalle en modo solo lectura. */
  order?: PurchaseOrder | null
}

const STATUS_VARIANT: Record<PurchaseOrderStatus, "outline" | "default" | "destructive"> = {
  pendiente: "outline",
  recibida: "default",
  cancelada: "destructive",
}

const EMPTY_VALUES: PurchaseOrderFormValues = { supplierId: "", lines: [], notes: "" }

function formatDay(isoString: string) {
  return formatDateTime(isoString, { year: "numeric", month: "short", day: "2-digit" })
}

export function PurchaseOrderFormDialog({ open, onOpenChange, order }: PurchaseOrderFormDialogProps) {
  const isReadOnly = Boolean(order)
  const { data: inventoryPage } = useInventoryList({ page: 1, pageSize: 100 })
  const inventoryItems = inventoryPage?.items ?? []
  const { data: suppliers } = useSuppliersList()
  const createPurchaseOrder = useCreatePurchaseOrder()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: EMPTY_VALUES,
  })

  const { fields, append, remove } = useFieldArray({ control, name: "lines" })

  useEffect(() => {
    if (!open) return
    reset(
      order
        ? {
            supplierId: order.supplierId,
            lines: order.lines.map((line) => ({ ...line, expirationDate: line.expirationDate ?? "" })),
            notes: order.notes ?? "",
          }
        : EMPTY_VALUES
    )
  }, [open, order, reset])

  async function onSubmit(values: PurchaseOrderFormValues) {
    if (isReadOnly) return
    try {
      await createPurchaseOrder.mutateAsync(values)
      toast.success("Orden de compra creada")
      reset(EMPTY_VALUES)
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReadOnly ? "Detalle de orden de compra" : "Nueva orden de compra"}
            {order && (
              <Badge variant={STATUS_VARIANT[order.status]}>{purchaseOrderStatusLabels[order.status]}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {order
              ? `Creada el ${formatDay(order.createdAt)}${
                  order.receivedAt ? ` · Recibida el ${formatDay(order.receivedAt)}` : ""
                }. Las órdenes de compra no se pueden editar.`
              : "Al recibir la orden se generan automáticamente los lotes y el movimiento de entrada de cada línea."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field data-invalid={!!errors.supplierId}>
              <FieldLabel htmlFor="supplierId">Proveedor</FieldLabel>
              <Controller
                control={control}
                name="supplierId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isReadOnly}>
                    <SelectTrigger id="supplierId" className="w-full" aria-invalid={!!errors.supplierId}>
                      <SelectValue placeholder="Selecciona un proveedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.supplierId ? [errors.supplierId] : undefined} />
              {!isReadOnly && suppliers && suppliers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay proveedores registrados. Créalos desde la pestaña Proveedores.
                </p>
              )}
            </Field>

            <FieldSeparator>Líneas de la orden</FieldSeparator>

            <div className="space-y-3">
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {isReadOnly ? "Esta orden no tiene líneas." : "Agrega al menos un insumo a la orden."}
                </p>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2">
                  <Field className="flex-1" data-invalid={!!errors.lines?.[index]?.itemId}>
                    <FieldLabel htmlFor={`lines.${index}.itemId`}>Insumo</FieldLabel>
                    <Controller
                      control={control}
                      name={`lines.${index}.itemId`}
                      render={({ field: itemField }) => (
                        <Select value={itemField.value} onValueChange={itemField.onChange} disabled={isReadOnly}>
                          <SelectTrigger id={`lines.${index}.itemId`} className="w-full">
                            <SelectValue placeholder="Selecciona un insumo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {inventoryItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>

                  <Field className="w-24" data-invalid={!!errors.lines?.[index]?.quantity}>
                    <FieldLabel htmlFor={`lines.${index}.quantity`}>Cantidad</FieldLabel>
                    <Input
                      id={`lines.${index}.quantity`}
                      type="number"
                      min={1}
                      disabled={isReadOnly}
                      {...register(`lines.${index}.quantity` as const)}
                    />
                  </Field>

                  <Field className="w-28" data-invalid={!!errors.lines?.[index]?.unitCost}>
                    <FieldLabel htmlFor={`lines.${index}.unitCost`}>Costo unit.</FieldLabel>
                    <Input
                      id={`lines.${index}.unitCost`}
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={isReadOnly}
                      {...register(`lines.${index}.unitCost` as const)}
                    />
                  </Field>

                  <Field className="w-40">
                    <FieldLabel htmlFor={`lines.${index}.expirationDate`}>Vencimiento</FieldLabel>
                    <Input
                      id={`lines.${index}.expirationDate`}
                      type="date"
                      disabled={isReadOnly}
                      {...register(`lines.${index}.expirationDate` as const)}
                    />
                  </Field>

                  {!isReadOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      aria-label="Quitar línea"
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}

              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ itemId: "", quantity: 1, unitCost: 0, expirationDate: "" })}
                >
                  Agregar línea
                </Button>
              )}
            </div>

            <Field>
              <FieldLabel htmlFor="notes">Notas (opcional)</FieldLabel>
              <Textarea id="notes" rows={2} disabled={isReadOnly} {...register("notes")} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            {isReadOnly ? (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting || fields.length === 0}>
                  {isSubmitting ? "Guardando..." : "Crear orden"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
