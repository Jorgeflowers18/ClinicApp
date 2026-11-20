import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { AlertTriangle, MoreHorizontal, Plus, Eye, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { getErrorMessage } from "@/shared/lib/error-message"
import { formatCurrency } from "@/shared/lib/number"
import { useDeleteInventoryItem } from "../api/inventory.queries"
import { useInventoryCatalog } from "../hooks/use-inventory-catalog"
import { itemKindLabels, itemKinds, type InventoryItem } from "../types/inventory.types"
import { InventoryConfirmDialog } from "./inventory-dialog"
import { InventoryItemFormDialog } from "./inventory-item-form-dialog"
import { InventoryToolbar } from "./inventory-toolbar"
import { InventoryFilter, ALL_INVENTORY as ALL } from "./inventory-filter"
import { InventoryStock, InventoryStockStatus, StockQuantity } from "./inventory-presentation"
import { isCriticalStock, inventoryStockState } from "../lib/inventory-display"

export function InventoryItemsTab({ onCritical }: { onCritical?: () => void }) {
  const navigate = useNavigate(), table = useTableQueryState(), catalog = useInventoryCatalog(), deletion = useDeleteInventoryItem()
  const [category, setCategory] = useState(ALL), [kind, setKind] = useState(ALL), [supplier, setSupplier] = useState(ALL), [stock, setStock] = useState(ALL)
  const [editing, setEditing] = useState<string | null>(null), [deleting, setDeleting] = useState<InventoryItem | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const query = table.debouncedSearch.trim().toLowerCase()
  const filtered = (catalog.data ?? []).filter(item => (!query || [item.name, item.category, item.supplier].join(" ").toLowerCase().includes(query)) && (category === ALL || item.category === category) && (kind === ALL || item.kind === kind) && (supplier === ALL || item.supplier === supplier) && (stock === ALL || (stock === "empty" ? item.stock === 0 : stock === "critical" ? isCriticalStock(item) : inventoryStockState(item) === "sufficient")))
  const pages = Math.max(1, Math.ceil(filtered.length / table.pageSize)), page = Math.min(table.page, pages)
  const visible = filtered.slice((page - 1) * table.pageSize, page * table.pageSize), criticalCount = visible.filter(item => isCriticalStock(item)).length
  const count = Number(Boolean(table.search.trim())) + [category, kind, supplier, stock].filter(value => value !== ALL).length
  const reset = () => { table.setSearch(""); setCategory(ALL); setKind(ALL); setSupplier(ALL); setStock(ALL); table.setPage(1) }
  const change = (setter: (value: string) => void) => (value: string) => { setter(value); table.setPage(1) }
  const options = (field: "category" | "supplier") => [...new Set((catalog.data ?? []).map(item => item[field]).filter((value): value is string => Boolean(value)))].sort((a,b)=>a.localeCompare(b)).map(value=>({value,label:value}))
  const filters = <><InventoryFilter label="Filtrar por categoría" value={category} onChange={change(setCategory)} allLabel="Todas las categorías" options={options("category")} /><InventoryFilter label="Filtrar por tipo" value={kind} onChange={change(setKind)} allLabel="Todos los tipos" options={itemKinds.map(value=>({value,label:itemKindLabels[value]}))} /><InventoryFilter label="Filtrar por proveedor" value={supplier} onChange={change(setSupplier)} allLabel="Todos los proveedores" options={options("supplier")} /><InventoryFilter label="Filtrar por stock" value={stock} onChange={change(setStock)} allLabel="Todo el stock" options={[{value:"sufficient",label:"Stock suficiente"},{value:"critical",label:"En mínimo o por debajo"},{value:"empty",label:"Agotado"}]} /></>
  const columns: DataTableColumn<InventoryItem>[] = [
    { key: "name", header: "Insumo", cell: item => <div><p className="inventory-item-name font-medium">{item.name}</p><div className="inventory-item-meta"><span>{item.category}</span>{!(item.kind === "instrumental" && item.category.trim().toLowerCase() === "instrumental") && <span>{itemKindLabels[item.kind]}</span>}{item.kind === "instrumental" && item.category.trim().toLowerCase() === "instrumental" && <span>Esterilizable</span>}</div></div> },
    { key: "stock", header: "Stock actual", cell: item => <InventoryStock item={item} /> },
    { key: "minStock", header: "Stock mínimo", cell: item => <StockQuantity quantity={item.minStock} unit={item.unit} secondary /> },
    { key: "stockStatus", header: "Estado", cell: item => <InventoryStockStatus item={item} /> },
    { key: "unitCost", header: "Costo unitario", cell: item => formatCurrency(item.unitCost) },
    { key: "supplier", header: "Proveedor", cell: item => item.supplier || "—" },
    { key: "actions", header: "Acciones", cell: item => <DropdownMenu><DropdownMenuTrigger className="inventory-action-trigger" aria-label={`Acciones del insumo ${item.name}`} onClick={event=>{ event.stopPropagation(); opener.current = event.currentTarget }} onKeyDown={event=>event.stopPropagation()}><MoreHorizontal /></DropdownMenuTrigger><DropdownMenuContent className="inventory-menu" align="end" onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}><DropdownMenuItem onClick={()=>navigate(`/inventario/${item.id}`)}><Eye />Ver detalle</DropdownMenuItem><DropdownMenuItem onClick={()=>setEditing(item.id)}><Pencil />Editar</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={()=>setDeleting(item)}><Trash2 />Eliminar</DropdownMenuItem></DropdownMenuContent></DropdownMenu> },
  ]
  return <div className="space-y-4"><InventoryToolbar search={table.search} onSearch={table.setSearch} label="Buscar insumos" placeholder="Buscar por nombre, categoría o proveedor..." filters={filters} filterCount={count} onClear={reset} action={<Button data-inventory-create onClick={event=>{opener.current=event.currentTarget;setEditing("new")}}><Plus />Nuevo insumo</Button>} />
    {!catalog.isPending && !catalog.isError && criticalCount > 0 && <div className="inventory-critical-alert"><AlertTriangle aria-hidden="true" /><span>{criticalCount} insumo{criticalCount===1?"":"s"} en el mínimo o por debajo en esta página.</span>{onCritical && <Button variant="ghost" size="sm" onClick={onCritical}>Ver stock crítico</Button>}</div>}
    <DataTable className="inventory-table inventory-items-table inventory-empty" columns={columns} data={visible} getRowId={item=>item.id} mobileTitleKey="name" isLoading={catalog.isPending} isError={catalog.isError} errorMessage={getErrorMessage(catalog.error)} onRowClick={item=>navigate(`/inventario/${item.id}`)} getRowLabel={item=>`Ver detalle del insumo ${item.name}`} emptyTitle={count ? "Sin coincidencias" : "Sin insumos"} emptyDescription={count ? "No hay insumos que coincidan con la búsqueda y los filtros." : "Todavía no hay insumos registrados."} />
    {catalog.data && <PaginationBar page={page} pageSize={table.pageSize} totalItems={filtered.length} totalPages={pages} onPageChange={table.setPage} />}
    <InventoryItemFormDialog returnFocus={() => opener.current} open={Boolean(editing)} itemId={editing==="new"?undefined:editing??undefined} onOpenChange={open=>{if(!open)setEditing(null)}} />
    <InventoryConfirmDialog open={Boolean(deleting)} onOpenChange={open=>{if(!open)setDeleting(null)}} title="Eliminar insumo" description={`¿Confirmas que deseas eliminar "${deleting?.name}"? Esta acción no se puede deshacer.`} confirmLabel="Eliminar" destructive pending={deletion.isPending} onConfirm={()=>{if(deleting && !deletion.isPending)deletion.mutate(deleting.id,{onSuccess:()=>{toast.success("Insumo eliminado");setDeleting(null)},onError:error=>toast.error(getErrorMessage(error))})}} />
  </div>
}
