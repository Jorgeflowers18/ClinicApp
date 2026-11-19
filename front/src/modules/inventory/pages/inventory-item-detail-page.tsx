import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Pencil, Plus } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { formatDateOnly, formatDateTime } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { formatCurrency } from "@/shared/lib/number"
import { useInventoryItem, useInventoryLots, useInventoryMovements } from "../api/inventory.queries"
import { RegisterMovementDialog } from "../components/register-movement-dialog"
import { InventoryItemFormDialog } from "../components/inventory-item-form-dialog"
import { InventoryStock, InventoryStockStatus, StockQuantity } from "../components/inventory-presentation"
import { inventoryUnit } from "../lib/inventory-display"
import { itemKindLabels, type StockLot, type StockMovement } from "../types/inventory.types"
import "../inventory.css"

export function InventoryItemDetailPage() {
  const {id}=useParams<{id:string}>(),navigate=useNavigate()
  const [movementOpen,setMovementOpen]=useState(false),[editing,setEditing]=useState(false)
  const query=useInventoryItem(id),movements=useInventoryMovements(id),lots=useInventoryLots(id),item=query.data
  if(query.isPending)return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-48" /></div>
  if(!item)return <Alert variant="destructive"><AlertTitle>No se pudo cargar el insumo</AlertTitle><AlertDescription>{getErrorMessage(query.error)}</AlertDescription></Alert>
  const day=(value:string)=>formatDateTime(value,{year:"numeric",month:"short",day:"2-digit"})
  const lotColumns:DataTableColumn<StockLot>[]=[
    {key:"date",header:"Recibido",cell:lot=>day(lot.receivedAt)},
    {key:"quantity",header:"Cantidad restante",cell:lot=><span className={lot.quantity===0?"text-muted-foreground":"tabular-nums"}>{lot.quantity} {inventoryUnit(item.unit,lot.quantity)}</span>},
    {key:"expiration",header:"Vencimiento",cell:lot=>lot.expirationDate?formatDateOnly(lot.expirationDate,{year:"numeric",month:"short",day:"2-digit"}):"Sin vencimiento"},
    {key:"source",header:"Origen",cell:lot=>lot.purchaseOrderId?"Compra":"Manual"},
  ]
  const movementColumns:DataTableColumn<StockMovement>[]=[
    {key:"type",header:"Tipo",cell:movement=><span className="inline-flex items-center gap-2">{movement.type==="entrada"?<ArrowDownToLine aria-hidden="true" className="size-4 text-success" />:<ArrowUpFromLine aria-hidden="true" className="size-4 text-destructive" />}{movement.type==="entrada"?"Entrada":"Salida"}</span>},
    {key:"quantity",header:"Cantidad",cell:movement=>`${movement.quantity} ${inventoryUnit(item.unit,movement.quantity)}`},
    {key:"reason",header:"Motivo",cell:movement=>movement.reason},
    {key:"date",header:"Fecha",cell:movement=>day(movement.createdAt)},
  ]
  return <div className="inventory-detail"><div><Button variant="ghost" size="sm" onClick={()=>navigate("/inventario")} className="mb-2 -ml-2"><ArrowLeft />Volver a inventario</Button><PageHeader title={item.name} description={item.category+" · "+itemKindLabels[item.kind]} actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setEditing(true)}><Pencil />Editar</Button><Button onClick={()=>setMovementOpen(true)}><Plus />Registrar movimiento</Button></div>} /></div>
    <dl className="inventory-detail-summary"><div><dt>Stock actual</dt><dd><InventoryStock item={item} /></dd></div><div><dt>Stock mínimo</dt><dd><StockQuantity quantity={item.minStock} unit={item.unit} secondary /></dd></div><div><dt>Estado de stock</dt><dd><InventoryStockStatus item={item} /></dd></div><div><dt>Costo unitario</dt><dd className="tabular-nums">{formatCurrency(item.unitCost)}</dd></div><div><dt>Proveedor</dt><dd>{item.supplier||"—"}</dd></div></dl>
    <Card><CardHeader><CardTitle>Lotes</CardTitle></CardHeader><CardContent><DataTable className="inventory-table inventory-empty" columns={lotColumns} data={lots.data??[]} getRowId={lot=>lot.id} mobileTitleKey="date" isLoading={lots.isPending} isError={lots.isError} errorMessage={getErrorMessage(lots.error)} emptyTitle="Sin lotes" emptyDescription="Sin lotes registrados todavía." /></CardContent></Card>
    <Card><CardHeader><CardTitle>Historial de movimientos</CardTitle></CardHeader><CardContent><DataTable className="inventory-table inventory-empty" columns={movementColumns} data={movements.data??[]} getRowId={movement=>movement.id} mobileTitleKey="type" isLoading={movements.isPending} isError={movements.isError} errorMessage={getErrorMessage(movements.error)} emptyTitle="Sin movimientos" emptyDescription="Sin movimientos registrados todavía." /></CardContent></Card>
    <RegisterMovementDialog itemId={item.id} itemName={item.name} currentStock={item.stock} unit={item.unit} open={movementOpen} onOpenChange={setMovementOpen} />
    <InventoryItemFormDialog open={editing} itemId={item.id} onOpenChange={setEditing} />
  </div>
}
