import { useEffect, useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useCreateInventoryItem, useInventoryItem, useUpdateInventoryItem } from "../api/inventory.queries"
import { inventoryItemSchema, itemKindLabels, itemKinds, type InventoryItem, type InventoryItemFormValues } from "../types/inventory.types"
import { useInventorySubmit } from "../hooks/use-inventory-submit"
import { InventoryDialog } from "./inventory-dialog"
import { InventoryField, InventoryFormError } from "./inventory-form-fields"

export function InventoryItemFormDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; returnFocus?: () => HTMLElement | null; itemId?: string; onSaved?: (item: InventoryItem) => void }) {
  return props.open ? <ItemDialog key={props.itemId ?? "new"} {...props} /> : null
}
function ItemDialog({ itemId, onOpenChange, onSaved, returnFocus }: { returnFocus?: () => HTMLElement | null; itemId?: string; onOpenChange: (open: boolean) => void; onSaved?: (item: InventoryItem) => void }) {
  const item = useInventoryItem(itemId)
  const [dirty, setDirty] = useState(false), [pending, setPending] = useState(false)
  return <InventoryDialog returnFocus={returnFocus} title={itemId ? "Editar insumo" : "Nuevo insumo"} description={itemId ? "Actualiza la información del insumo." : "Registra un nuevo insumo. El stock inicial se registra mediante una entrada."} dirty={dirty} pending={pending} onClose={() => onOpenChange(false)}>
    {({ close, cancel }) => itemId && item.isPending ? <div className="inventory-editor" aria-label="Cargando insumo"><Skeleton className="h-48" /></div>
      : itemId && !item.data ? <div className="inventory-editor"><Alert variant="destructive"><AlertTitle>No se pudo cargar el insumo</AlertTitle><AlertDescription>{getErrorMessage(item.error)}</AlertDescription><Button variant="outline" onClick={() => void item.refetch()}>Reintentar</Button></Alert></div>
        : <ItemEditor key={itemId ?? "new"} item={item.data} close={close} cancel={cancel} onDirty={setDirty} onPending={setPending} onSaved={onSaved} />}
  </InventoryDialog>
}
function ItemEditor({ item, close, cancel, onDirty, onPending, onSaved }: { item?: InventoryItem; close: () => void; cancel: () => void; onDirty: (value: boolean) => void; onPending: (value: boolean) => void; onSaved?: (item: InventoryItem) => void }) {
  const create = useCreateInventoryItem(), update = useUpdateInventoryItem(item?.id ?? "")
  const form = useForm<InventoryItemFormValues>({ resolver: zodResolver(inventoryItemSchema), defaultValues: item ? { name: item.name, category: item.category, unit: item.unit, kind: item.kind, minStock: item.minStock, unitCost: item.unitCost, supplier: item.supplier ?? "" } : { name: "", category: "", unit: "", kind: "consumible", minStock: 0, unitCost: 0, supplier: "" } })
  const { isDirty, isSubmitting } = form.formState
  useEffect(() => onDirty(isDirty), [isDirty, onDirty])
  useEffect(() => onPending(isSubmitting), [isSubmitting, onPending])
  const save = useInventorySubmit(form, async values => { const saved = item ? await update.mutateAsync(values) : await create.mutateAsync(values); onSaved?.(saved) }, item ? "Insumo actualizado" : "Insumo creado. Registra una entrada de stock para inicializarlo.")
  return <FormProvider {...form}><form className="inventory-editor" noValidate onSubmit={event => void form.handleSubmit(values => save(values, close))(event)}>
    <InventoryFormError /><fieldset disabled={isSubmitting} className="inventory-form-group"><h3>Información general</h3>
      <InventoryField name="name" label="Nombre" />
      <div className="inventory-form-grid"><InventoryField name="category" label="Categoría" /><InventoryField name="unit" label="Unidad de medida" placeholder="unidad, caja, ml..." /><InventoryField name="kind" label="Tipo de insumo" options={itemKinds.map(value => ({ value, label: itemKindLabels[value] }))} hint="El instrumental esterilizable puede incluirse en ciclos de esterilización." /><InventoryField name="supplier" label="Proveedor" /></div>
      <h3>Control de existencias</h3><div className="inventory-form-grid"><InventoryField name="minStock" label="Stock mínimo" type="number" min={0} hint="Se genera una alerta cuando el stock es menor o igual al mínimo." /><InventoryField name="unitCost" label="Costo unitario (USD)" type="number" min={0} step="0.01" /></div>
      {!item && <p className="inventory-hint">El stock inicial se agrega mediante Registrar movimiento → Entrada.</p>}
    </fieldset><div className="inventory-form-actions"><Button type="button" variant="outline" disabled={isSubmitting} onClick={cancel}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : item ? "Guardar cambios" : "Crear insumo"}</Button></div>
  </form></FormProvider>
}
