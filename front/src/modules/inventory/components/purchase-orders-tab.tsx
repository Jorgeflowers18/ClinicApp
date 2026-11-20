import { FilterField } from "@/shared/components/filter-field"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Plus, MoreHorizontal, Eye, PackageCheck, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { formatDateTime } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useCancelPurchaseOrder, usePurchaseOrdersList, useReceivePurchaseOrder, useSuppliersList } from "../api/inventory.queries"
import { PurchaseOrderFormDialog } from "./purchase-order-form-dialog"
import { InventoryConfirmDialog } from "./inventory-dialog"
import { InventoryToolbar } from "./inventory-toolbar"
import { InventoryFilter, ALL_INVENTORY as ALL } from "./inventory-filter"
import { InventoryStatus } from "./inventory-presentation"
import { purchaseOrderStatusLabels, purchaseOrderStatuses, type PurchaseOrder } from "../types/inventory.types"

export function PurchaseOrdersTab() {
  const orders=usePurchaseOrdersList(),suppliers=useSuppliersList(),receive=useReceivePurchaseOrder(),cancel=useCancelPurchaseOrder(),table=useTableQueryState()
  const [open,setOpen]=useState(false),[selected,setSelected]=useState<PurchaseOrder|null>(null),[action,setAction]=useState<{order:PurchaseOrder;type:"receive"|"cancel"}|null>(null)
  const [supplier,setSupplier]=useState(ALL),[status,setStatus]=useState(ALL),[date,setDate]=useState("")
  const locked=useRef(false)
  const name=(id:string)=>suppliers.data?.find(s=>s.id===id)?.name??(suppliers.isPending?"Cargando proveedor…":"Proveedor no disponible")
  const search=table.debouncedSearch.trim().toLowerCase()
  const items=(orders.data??[]).filter(order=>(!search||[name(order.supplierId),order.notes].join(" ").toLowerCase().includes(search))&&(supplier===ALL||order.supplierId===supplier)&&(status===ALL||order.status===status)&&(!date||(new Date(order.createdAt)>=new Date(date+"T00:00:00")&&new Date(order.createdAt)<=new Date(date+"T23:59:59.999"))))
  const pages=Math.max(1,Math.ceil(items.length/table.pageSize)),page=Math.min(table.page,pages)
  const count=Number(Boolean(table.search))+Number(supplier!==ALL)+Number(status!==ALL)+Number(Boolean(date))
  function clear(){table.setSearch("");setSupplier(ALL);setStatus(ALL);setDate("");table.setPage(1)}
  function detail(order:PurchaseOrder){setSelected(order);setOpen(true)}
  async function confirm(){if(!action||locked.current)return;locked.current=true;try{if(action.type==="receive"){await receive.mutateAsync(action.order.id);toast.success("Orden recibida, stock actualizado")}else{await cancel.mutateAsync(action.order.id);toast.success("Orden cancelada")}setAction(null)}catch(error){toast.error(getErrorMessage(error))}finally{locked.current=false}}
  const filters=<><InventoryFilter label="Filtrar compras por proveedor" value={supplier} onChange={v=>{setSupplier(v);table.setPage(1)}} allLabel="Todos los proveedores" options={(suppliers.data??[]).map(s=>({value:s.id,label:s.name}))} /><InventoryFilter label="Filtrar compras por estado" value={status} onChange={v=>{setStatus(v);table.setPage(1)}} allLabel="Todos los estados" options={purchaseOrderStatuses.map(value=>({value,label:purchaseOrderStatusLabels[value]}))} /><FilterField label="Fecha"><Input className="inventory-filter" aria-label="Filtrar compras por fecha" type="date" value={date} onChange={e=>{setDate(e.target.value);table.setPage(1)}} /></FilterField></>
  const columns:DataTableColumn<PurchaseOrder>[]=[
    {key:"supplier",header:"Proveedor",cell:order=><span className="font-medium">{name(order.supplierId)}</span>},
    {key:"lines",header:"Líneas",cell:order=>order.lines.length},
    {key:"status",header:"Estado",cell:order=><InventoryStatus label={purchaseOrderStatusLabels[order.status]} tone={order.status==="recibida"?"success":order.status==="pendiente"?"warning":"danger"} />},
    {key:"date",header:"Fecha",cell:order=>formatDateTime(order.createdAt,{year:"numeric",month:"short",day:"2-digit"})},
    {key:"actions",header:"Acciones",cell:order=><DropdownMenu><DropdownMenuTrigger className="inventory-action-trigger" aria-label={`Acciones de compra de ${name(order.supplierId)}`} onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}><MoreHorizontal /></DropdownMenuTrigger><DropdownMenuContent className="inventory-menu" align="end" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}><DropdownMenuItem onClick={()=>detail(order)}><Eye />Ver detalle</DropdownMenuItem>{order.status==="pendiente"&&<><DropdownMenuSeparator /><DropdownMenuItem disabled={receive.isPending||cancel.isPending} onClick={()=>setAction({order,type:"receive"})}><PackageCheck />Recibir</DropdownMenuItem><DropdownMenuItem variant="destructive" disabled={receive.isPending||cancel.isPending} onClick={()=>setAction({order,type:"cancel"})}><XCircle />Cancelar</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>},
  ]
  return <div className="space-y-4"><InventoryToolbar search={table.search} onSearch={table.setSearch} label="Buscar compras" placeholder="Buscar por proveedor u observaciones..." filters={filters} filterCount={count} onClear={clear} action={<Button data-inventory-create onClick={()=>{setSelected(null);setOpen(true)}}><Plus />Nueva orden</Button>} />
    {suppliers.isError&&<Alert variant="destructive"><AlertTitle>No se pudieron cargar los nombres de proveedores</AlertTitle><AlertDescription>{getErrorMessage(suppliers.error)}</AlertDescription></Alert>}
    <DataTable className="inventory-table inventory-empty" columns={columns} data={items.slice((page-1)*table.pageSize,page*table.pageSize)} getRowId={order=>order.id} mobileTitleKey="supplier" isLoading={orders.isPending} isError={orders.isError} errorMessage={getErrorMessage(orders.error)} onRowClick={detail} getRowLabel={order=>`Ver orden de compra de ${name(order.supplierId)}`} emptyTitle={count?"Sin coincidencias":"Sin órdenes de compra"} emptyDescription={count?"No hay órdenes con estos criterios.":"Todavía no hay órdenes de compra registradas."} />
    {orders.data&&<PaginationBar page={page} pageSize={table.pageSize} totalItems={items.length} totalPages={pages} onPageChange={table.setPage} />}
    <PurchaseOrderFormDialog open={open} onOpenChange={setOpen} order={selected} />
    <InventoryConfirmDialog open={Boolean(action)} onOpenChange={value=>{if(!value)setAction(null)}} title={action?.type==="receive"?"Recibir orden de compra":"Cancelar orden de compra"} description={action?.type==="receive"?"Se registrarán las entradas y los lotes de esta orden pendiente.":"La orden pendiente se cancelará sin registrar entradas de inventario."} confirmLabel={action?.type==="receive"?"Recibir":"Cancelar orden"} destructive={action?.type==="cancel"} pending={receive.isPending||cancel.isPending} onConfirm={()=>void confirm()} />
  </div>
}
