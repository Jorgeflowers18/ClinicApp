import { useNavigate } from "react-router-dom"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useInventoryCatalog } from "../hooks/use-inventory-catalog"
import type { InventoryItem } from "../types/inventory.types"
import { InventoryToolbar } from "./inventory-toolbar"
import { InventoryStock, InventoryStockStatus, StockQuantity } from "./inventory-presentation"
import { isCriticalStock } from "../lib/inventory-display"

export function CriticalStockTab() {
  const catalog = useInventoryCatalog(), table = useTableQueryState(), navigate = useNavigate()
  const query = table.debouncedSearch.trim().toLowerCase()
  const items = (catalog.data ?? []).filter(item=>isCriticalStock(item) && (!query || [item.name,item.category,item.supplier].join(" ").toLowerCase().includes(query)))
  const pages = Math.max(1,Math.ceil(items.length/table.pageSize)), page=Math.min(table.page,pages)
  const columns: DataTableColumn<InventoryItem>[] = [
    {key:"name",header:"Insumo",cell:item=><div><p className="inventory-item-name font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.category}</p></div>},
    {key:"stock",header:"Stock actual",cell:item=><InventoryStock item={item} progress />},
    {key:"minimum",header:"Stock mínimo",cell:item=><StockQuantity quantity={item.minStock} unit={item.unit} secondary />},
    {key:"supplier",header:"Proveedor",cell:item=>item.supplier||"—"},
    {key:"status",header:"Estado",cell:item=><InventoryStockStatus item={item} />},
  ]
  return <div className="space-y-4"><InventoryToolbar search={table.search} onSearch={table.setSearch} label="Buscar insumos críticos" placeholder="Buscar por nombre, categoría o proveedor..." filterCount={Number(Boolean(table.search))} onClear={()=>table.setSearch("")} /><p className="inventory-hint">Existencias menores o iguales al mínimo. La barra compara el stock actual con ese mínimo.</p>
    <DataTable className="inventory-table inventory-empty" columns={columns} data={items.slice((page-1)*table.pageSize,page*table.pageSize)} getRowId={item=>item.id} mobileTitleKey="name" isLoading={catalog.isPending} isError={catalog.isError} errorMessage={getErrorMessage(catalog.error)} onRowClick={item=>navigate(`/inventario/${item.id}`)} getRowLabel={item=>`Ver detalle del insumo ${item.name}`} emptyTitle={query?"Sin coincidencias":"Sin stock crítico"} emptyDescription={query?"No hay insumos críticos que coincidan con la búsqueda.":"No hay insumos en el mínimo o por debajo."} />
    {catalog.data && <PaginationBar page={page} pageSize={table.pageSize} totalItems={items.length} totalPages={pages} onPageChange={table.setPage} />}
  </div>
}
