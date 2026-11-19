import { useRef, useState } from "react"
import { toast } from "sonner"
import { MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useDeleteSupplier, useSuppliersList } from "../api/inventory.queries"
import { SupplierFormDialog } from "./supplier-form-dialog"
import { InventoryConfirmDialog } from "./inventory-dialog"
import { InventoryToolbar } from "./inventory-toolbar"
import type { Supplier } from "../types/inventory.types"

export function SuppliersTab() {
  const opener = useRef<HTMLElement | null>(null)
  const query = useSuppliersList(), deletion = useDeleteSupplier(), table = useTableQueryState()
  const [open,setOpen]=useState(false),[editing,setEditing]=useState<Supplier|null>(null),[deleting,setDeleting]=useState<Supplier|null>(null)
  const search=table.debouncedSearch.trim().toLowerCase()
  const items=(query.data??[]).filter(item=>!search||[item.name,item.contactName,item.email,item.phone,item.address,item.notes].join(" ").toLowerCase().includes(search))
  const pages=Math.max(1,Math.ceil(items.length/table.pageSize)),page=Math.min(table.page,pages)
  function edit(item:Supplier){setEditing(item);setOpen(true)}
  const columns:DataTableColumn<Supplier>[]=[
    {key:"name",header:"Proveedor",cell:item=><div><p className="inventory-item-name font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.contactName||"Sin contacto asignado"}</p></div>},
    {key:"phone",header:"Teléfono",cell:item=>item.phone||"—"},{key:"email",header:"Correo",cell:item=>item.email||"—"},{key:"address",header:"Dirección",cell:item=>item.address||"—"},
    {key:"actions",header:"Acciones",cell:item=><DropdownMenu><DropdownMenuTrigger className="inventory-action-trigger" aria-label={`Acciones del proveedor ${item.name}`} onClick={e=>{e.stopPropagation();opener.current=e.currentTarget}} onKeyDown={e=>e.stopPropagation()}><MoreHorizontal /></DropdownMenuTrigger><DropdownMenuContent className="inventory-menu" align="end" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}><DropdownMenuItem onClick={()=>edit(item)}><Pencil />Editar</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={()=>setDeleting(item)}><Trash2 />Eliminar</DropdownMenuItem></DropdownMenuContent></DropdownMenu>},
  ]
  return <div className="space-y-4"><InventoryToolbar search={table.search} onSearch={table.setSearch} label="Buscar proveedores" placeholder="Buscar por nombre, contacto, teléfono o correo..." filterCount={Number(Boolean(table.search))} onClear={()=>table.setSearch("")} action={<Button data-inventory-create onClick={e=>{opener.current=e.currentTarget;setEditing(null);setOpen(true)}}><Plus />Nuevo proveedor</Button>} />
    <DataTable className="inventory-table inventory-empty" columns={columns} data={items.slice((page-1)*table.pageSize,page*table.pageSize)} getRowId={item=>item.id} mobileTitleKey="name" isLoading={query.isPending} isError={query.isError} errorMessage={getErrorMessage(query.error)} onRowClick={edit} getRowLabel={item=>`Editar proveedor: ${item.name}`} emptyTitle={search?"Sin coincidencias":"Sin proveedores"} emptyDescription={search?"No hay proveedores que coincidan con la búsqueda.":"Registra proveedores para elegirlos en las órdenes de compra."} />
    {query.data&&<PaginationBar page={page} pageSize={table.pageSize} totalItems={items.length} totalPages={pages} onPageChange={table.setPage} />}
    <SupplierFormDialog returnFocus={() => opener.current} open={open} onOpenChange={setOpen} supplier={editing} />
    <InventoryConfirmDialog open={Boolean(deleting)} onOpenChange={value=>{if(!value)setDeleting(null)}} title="Eliminar proveedor" description={`¿Confirmas que deseas eliminar a "${deleting?.name}"? No se puede eliminar si tiene órdenes de compra asociadas.`} confirmLabel="Eliminar" destructive pending={deletion.isPending} onConfirm={()=>{if(deleting&&!deletion.isPending)deletion.mutate(deleting.id,{onSuccess:()=>{toast.success("Proveedor eliminado");setDeleting(null)},onError:error=>toast.error(getErrorMessage(error))})}} />
  </div>
}
