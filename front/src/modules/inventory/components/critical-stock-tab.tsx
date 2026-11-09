import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"

import { useInventoryList } from "../api/inventory.queries"

export function CriticalStockTab() {
  const { data, isLoading } = useInventoryList({ page: 1, pageSize: 100 })
  const criticalItems = (data?.items ?? []).filter((item) => item.stock <= item.minStock)

  const columns: DataTableColumn<(typeof criticalItems)[number]>[] = [
    { key: "name", header: "Insumo", cell: (item) => item.name },
    { key: "category", header: "Categoría", cell: (item) => item.category },
    { key: "stock", header: "Stock", cell: (item) => `${item.stock} ${item.unit}` },
    { key: "minimum", header: "Mínimo", cell: (item) => `${item.minStock} ${item.unit}` },
    {
      key: "status",
      header: "Estado",
      cell: (item) => (
        <Badge variant={item.stock === 0 ? "destructive" : "outline"}>
          {item.stock === 0 ? "Agotado" : "Bajo mínimo"}
        </Badge>
      ),
    },
  ]

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />
  }

  if (criticalItems.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Ningún insumo está por debajo de su stock mínimo.
      </p>
    )
  }

  return (
    <DataTable
      columns={columns}
      data={criticalItems}
      getRowId={(item) => item.id}
      mobileTitleKey="name"
      emptyTitle="Sin stock crítico"
      emptyDescription="Ningún insumo está por debajo de su stock mínimo."
    />
  )
}
