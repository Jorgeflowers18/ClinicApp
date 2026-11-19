import { useForm, FormProvider, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { useRegisterMovement } from "../api/inventory.queries"
import { movementSchema, type MovementFormValues } from "../types/inventory.types"
import { useInventorySubmit } from "../hooks/use-inventory-submit"
import { InventoryDialog } from "./inventory-dialog"
import { InventoryField, InventoryFormError } from "./inventory-form-fields"
import { inventoryUnit } from "../lib/inventory-display"

interface Props { itemId: string; itemName: string; currentStock: number; unit: string; open: boolean; onOpenChange: (open: boolean) => void }
export function RegisterMovementDialog(props: Props) { return props.open ? <MovementEditor key={props.itemId} {...props} /> : null }
function MovementEditor({ itemId, itemName, currentStock, unit, onOpenChange }: Props) {
  const mutation = useRegisterMovement(itemId)
  const form = useForm<MovementFormValues>({ resolver: zodResolver(movementSchema), defaultValues: { type: "entrada", quantity: 1, reason: "", expirationDate: "" } })
  const type = useWatch({ control: form.control, name: "type" })
  const save = useInventorySubmit(form, values => mutation.mutateAsync(values), "Movimiento registrado")
  const { isDirty, isSubmitting } = form.formState
  return <InventoryDialog size="movement" title="Registrar movimiento" description={`${itemName} · Stock actual: ${currentStock} ${inventoryUnit(unit, currentStock)}`} dirty={isDirty} pending={isSubmitting} onClose={() => onOpenChange(false)}>
    {({ close, cancel }) => <FormProvider {...form}><form className="inventory-editor" noValidate onSubmit={event => void form.handleSubmit(values => save(values, close))(event)}><InventoryFormError /><fieldset disabled={isSubmitting} className="inventory-form-group">
      <div className="inventory-form-grid"><InventoryField name="type" label="Tipo de movimiento" options={[{ value: "entrada", label: "Entrada" }, { value: "salida", label: "Salida" }]} /><InventoryField name="quantity" label="Cantidad" type="number" min={1} /></div>
      {type === "entrada" && <InventoryField name="expirationDate" label="Fecha de vencimiento (opcional)" type="date" />}<InventoryField name="reason" label="Motivo" type="textarea" placeholder="Ej. Compra a proveedor, uso en tratamiento..." />
    </fieldset><div className="inventory-form-actions"><Button type="button" variant="outline" disabled={isSubmitting} onClick={cancel}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Registrar"}</Button></div></form></FormProvider>}
  </InventoryDialog>
}
