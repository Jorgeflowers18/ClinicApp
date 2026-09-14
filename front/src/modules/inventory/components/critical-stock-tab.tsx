import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { useInventoryList } from "../api/inventory.queries"

export function CriticalStockTab() {
  const { data, isLoading } = useInventoryList({ page: 1, pageSize: 100 })
  const criticalItems = (data?.items ?? []).filter((item) => item.stock <= item.minStock)

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
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Insumo</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Mínimo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {criticalItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-muted-foreground">{item.category}</TableCell>
              <TableCell>
                {item.stock} {item.unit}
              </TableCell>
              <TableCell>
                {item.minStock} {item.unit}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
