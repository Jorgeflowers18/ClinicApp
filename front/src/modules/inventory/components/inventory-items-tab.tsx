import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { AlertTriangle, MoreHorizontal, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { SearchInput } from "@/shared/components/search-input"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { getErrorMessage } from "@/shared/lib/error-message"

import { useDeleteInventoryItem, useInventoryList } from "../api/inventory.queries"
import type { InventoryItem } from "../types/inventory.types"

export function InventoryItemsTab() {
  const navigate = useNavigate()
  const { search, setSearch, debouncedSearch, page, setPage, pageSize } = useTableQueryState()
  const { data, isLoading, isError, error } = useInventoryList({
    page,
    pageSize,
    search: debouncedSearch,
  })
  const deleteItem = useDeleteInventoryItem()
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null)

  const lowStockCount = data?.items.filter((item) => item.stock <= item.minStock).length ?? 0

  const columns: DataTableColumn<InventoryItem>[] = [
    {
      key: "name",
      header: "Insumo",
      cell: (row) => (
        <div>
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {row.name}
            {row.kind === "instrumental" && <Badge variant="secondary">Instrumental</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">{row.category}</p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {row.stock} {row.unit}
          </span>
          {row.stock <= row.minStock && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="size-3" />
              Bajo mínimo
            </Badge>
          )}
        </div>
      ),
    },
    { key: "minStock", header: "Mínimo", cell: (row) => `${row.minStock} ${row.unit}` },
    { key: "unitCost", header: "Costo unitario", cell: (row) => `$${row.unitCost.toFixed(2)}` },
    { key: "supplier", header: "Proveedor", cell: (row) => row.supplier || "—" },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/inventario/${row.id}`)}>
              Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/inventario/${row.id}/editar`)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setItemToDelete(row)}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  function handleDelete() {
    if (!itemToDelete) return
    deleteItem.mutate(itemToDelete.id, {
      onSuccess: () => {
        toast.success("Insumo eliminado")
        setItemToDelete(null)
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, categoría o proveedor..." />
        <Button onClick={() => navigate("/inventario/nuevo")}>
          <Plus />
          Nuevo insumo
        </Button>
      </div>

      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {lowStockCount} insumo{lowStockCount > 1 ? "s" : ""} por debajo del stock mínimo en esta página.
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={getErrorMessage(error)}
        onRowClick={(row) => navigate(`/inventario/${row.id}`)}
        emptyTitle="Sin insumos"
        emptyDescription="Aún no hay insumos registrados con estos criterios."
      />

      {data && (
        <PaginationBar
          page={data.page}
          pageSize={data.pageSize}
          totalItems={data.totalItems}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title="Eliminar insumo"
        description={`¿Confirmas que deseas eliminar "${itemToDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        isLoading={deleteItem.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
