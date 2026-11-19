import { useRef } from "react"
import { FormProvider, useFieldArray, useForm, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2, LockKeyhole, Truck, CalendarDays, Package, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { formatDateTime, formatDateOnly } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useCreatePurchaseOrder, useSuppliersList } from "../api/inventory.queries"
import { useInventoryCatalog } from "../hooks/use-inventory-catalog"
import { useInventoryAccordion } from "../hooks/use-inventory-accordion"
import { useInventorySubmit } from "../hooks/use-inventory-submit"
import { purchaseOrderSchema, purchaseOrderStatusLabels, type PurchaseOrder, type PurchaseOrderFormValues, type PurchaseOrderLine } from "../types/inventory.types"
import { InventoryDialog } from "./inventory-dialog"
import { InventoryField, InventoryFormError } from "./inventory-form-fields"
import { InventorySections } from "./inventory-sections"
import { InventoryStatus } from "./inventory-presentation"
import { inventoryUnit } from "../lib/inventory-display"

interface Props { open: boolean; onOpenChange: (open: boolean) => void; order?: PurchaseOrder | null }
export function PurchaseOrderFormDialog(props: Props) {
  if(!props.open) return null
  return props.order ? <PurchaseDetail order={props.order} onClose={() => props.onOpenChange(false)} /> : <PurchaseEditor onClose={() => props.onOpenChange(false)} />
}
function PurchaseDetail({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const inventory = useInventoryCatalog(), suppliers = useSuppliersList()
  const columns: DataTableColumn<PurchaseOrderLine>[] = [
    { key: "name", header: "Insumo", cell: line => inventory.data?.find(item => item.id === line.itemId)?.name ?? (inventory.isPending ? "Cargando insumo…" : "Insumo no disponible") },
    { key: "quantity", header: "Cantidad", cell: line => { const item = inventory.data?.find(item => item.id === line.itemId); return line.quantity + (item ? " " + inventoryUnit(item.unit, line.quantity) : "") } },
    { key: "cost", header: "Costo unitario", cell: line => formatCurrency(line.unitCost) },
    { key: "expiration", header: "Vencimiento", cell: line => line.expirationDate ? formatDateOnly(line.expirationDate) : "Sin vencimiento" },
  ]
  return <InventoryDialog size="purchase-detail" title="Detalle de orden de compra" description={<span className="inventory-readonly-note"><LockKeyhole aria-hidden="true" />Consulta de solo lectura. Las órdenes no se pueden editar.</span>} onClose={onClose}>
    {({ cancel }) => <div className="inventory-editor"><dl className="inventory-readonly inventory-order-summary"><div><dt><Truck aria-hidden="true" />Proveedor</dt><dd>{suppliers.data?.find(supplier => supplier.id === order.supplierId)?.name ?? (suppliers.isPending ? "Cargando proveedor…" : "Proveedor no disponible")}</dd></div><div><dt><CalendarDays aria-hidden="true" />Creada el</dt><dd><time dateTime={order.createdAt} title={formatDateTime(order.createdAt)}>{formatDateTime(order.createdAt, { year: "numeric", month: "short", day: "2-digit" })}</time></dd></div><div><dt>Estado</dt><dd><InventoryStatus label={purchaseOrderStatusLabels[order.status]} tone={order.status === "recibida" ? "success" : order.status === "pendiente" ? "warning" : "danger"} /></dd></div>{order.receivedAt && <div><dt>Recibida el</dt><dd><time dateTime={order.receivedAt}>{formatDateTime(order.receivedAt)}</time></dd></div>}</dl>
      {(inventory.isError || suppliers.isError) && <Alert variant="destructive"><AlertTitle>No se pudieron resolver todos los nombres</AlertTitle><AlertDescription>{getErrorMessage(inventory.error ?? suppliers.error)}</AlertDescription></Alert>}
      <h3 className="inventory-order-heading"><Package aria-hidden="true" />Insumos de la orden<small>{order.lines.length} {order.lines.length === 1 ? "línea" : "líneas"}</small></h3>
      <DataTable className="inventory-table inventory-order-lines" columns={columns} data={order.lines} getRowId={line => String(order.lines.indexOf(line))} mobileTitleKey="name" emptyTitle="Sin líneas" emptyDescription="Esta orden no tiene líneas." />
      <section className="inventory-order-notes"><h3 className="inventory-order-heading"><FileText aria-hidden="true" />Observaciones</h3><p>{order.notes || "Sin observaciones registradas."}</p></section><div className="inventory-form-actions"><Button variant="outline" onClick={cancel}>Cerrar</Button></div>
    </div>}
  </InventoryDialog>
}
function PurchaseEditor({ onClose }: { onClose: () => void }) {
  const inventory = useInventoryCatalog(), suppliers = useSuppliersList(), create = useCreatePurchaseOrder()
  const form = useForm<PurchaseOrderFormValues>({ resolver: zodResolver(purchaseOrderSchema), shouldUnregister: false, shouldFocusError: false, defaultValues: { supplierId: "", lines: [], notes: "" } })
  const element = useRef<HTMLFormElement>(null), accordion = useInventoryAccordion(element)
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" })
  const reveal = (field: string) => accordion.request(field.startsWith("lines") ? "lines" : field === "notes" ? "notes" : "general", `[id="${CSS.escape(field)}"]`)
  const save = useInventorySubmit(form, values => create.mutateAsync(values), "Orden de compra creada", reveal)
  function invalid(errors: FieldErrors<PurchaseOrderFormValues>) {
    const field = Object.keys(errors)[0]
    if(field === "lines") { const index = errors.lines?.findIndex?.(line => Boolean(line)) ?? -1; const row = index >= 0 ? errors.lines?.[index] : null; reveal(index < 0 ? "lines" : `lines.${index}.${row?.itemId ? "itemId" : row?.quantity ? "quantity" : row?.unitCost ? "unitCost" : "expirationDate"}`) }
    else if(field) reveal(field)
  }
  const { errors, isDirty, isSubmitting } = form.formState
  return <InventoryDialog size="purchase" title="Nueva orden de compra" description="Al recibir la orden se generan los lotes y movimientos de entrada. Crear la orden no modifica el stock." dirty={isDirty} pending={isSubmitting} onClose={onClose}>
    {({ close, cancel }) => <FormProvider {...form}><form ref={element} className="inventory-editor" noValidate onSubmit={event => void form.handleSubmit(values => save(values, close), invalid)(event)}><InventoryFormError /><fieldset disabled={isSubmitting}><InventorySections controller={accordion} groups={[
      { id: "general", title: "Información de la compra", invalid: Boolean(errors.supplierId), content: <><InventoryField name="supplierId" label="Proveedor" options={(suppliers.data ?? []).map(supplier => ({ value: supplier.id, label: supplier.name }))} disabled={suppliers.isPending || suppliers.isError} placeholder={suppliers.isPending ? "Cargando proveedores…" : "Selecciona un proveedor..."} />{suppliers.isError ? <Alert variant="destructive"><AlertTitle>No se pudieron cargar los proveedores</AlertTitle><AlertDescription>{getErrorMessage(suppliers.error)}</AlertDescription><Button type="button" variant="outline" onClick={() => void suppliers.refetch()}>Reintentar</Button></Alert> : suppliers.data?.length === 0 && <p className="inventory-hint">No hay proveedores registrados. Créalos desde Proveedores.</p>}</> },
      { id: "lines", title: "Insumos adquiridos", summary: `${fields.length} líneas`, invalid: Boolean(errors.lines), content: <><div id="lines" tabIndex={-1} className="inventory-purchase-lines" aria-describedby={errors.lines ? "lines-error" : undefined}>{fields.length === 0 && <p className="inventory-hint">Agrega al menos un insumo a la orden.</p>}{fields.map((entry, index) => <div className="inventory-purchase-line" key={entry.id}><InventoryField name={`lines.${index}.itemId`} label="Insumo" options={(inventory.data ?? []).map(item => ({ value: item.id, label: item.name }))} disabled={inventory.isPending || inventory.isError} /><InventoryField name={`lines.${index}.quantity`} label="Cantidad" type="number" min={1} /><InventoryField name={`lines.${index}.unitCost`} label="Costo unit. (USD)" type="number" min={0} step="0.01" /><InventoryField name={`lines.${index}.expirationDate`} label="Vencimiento" type="date" /><Button type="button" variant="ghost" size="icon" aria-label={`Quitar línea ${index + 1}`} onClick={() => remove(index)}><Trash2 /></Button></div>)}</div>{errors.lines?.message && <p id="lines-error" role="alert" className="text-sm text-destructive">{errors.lines.message}</p>}{inventory.isError && <Alert variant="destructive"><AlertTitle>No se pudieron cargar los insumos</AlertTitle><AlertDescription>{getErrorMessage(inventory.error)}</AlertDescription><Button type="button" variant="outline" onClick={() => void inventory.refetch()}>Reintentar</Button></Alert>}<Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={inventory.isPending || inventory.isError} onClick={() => append({ itemId: "", quantity: 1, unitCost: 0, expirationDate: "" })}><Plus />Agregar línea</Button></> },
      { id: "notes", title: "Resumen y observaciones", content: <><p className="inventory-hint">{fields.length} líneas en esta orden. Las existencias se actualizan únicamente al recibirla.</p><InventoryField name="notes" label="Notas (opcional)" type="textarea" /></> },
    ]} /></fieldset><div className="inventory-form-actions"><Button type="button" variant="outline" disabled={isSubmitting} onClick={cancel}>Cancelar</Button><Button type="submit" disabled={isSubmitting || fields.length === 0}>{isSubmitting ? "Guardando..." : "Crear orden"}</Button></div></form></FormProvider>}
  </InventoryDialog>
}
