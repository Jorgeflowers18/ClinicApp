import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadCsv } from "@/shared/lib/csv"
import { formatDateTime } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import type { PurchaseOrderStatus } from "@/modules/inventory/types/inventory.types"

import { useInventoryReport } from "../api/reports.queries"
import { formatPeriodLabel } from "../lib/period"
import type { ReportPeriod } from "../types/report.types"
import { ReportTableCard } from "./report-table-card"

const STATUS_VARIANT: Record<PurchaseOrderStatus, "outline" | "default" | "destructive"> = {
  pendiente: "outline",
  recibida: "default",
  cancelada: "destructive",
}

interface InventoryReportTabProps {
  period: ReportPeriod
}

export function InventoryReportTab({ period }: InventoryReportTabProps) {
  const { data, isLoading } = useInventoryReport(period)
  const suffix = formatPeriodLabel(period)
  const critical = data?.criticalItems ?? []
  const purchases = data?.purchasesInPeriod ?? []
  const consumption = data?.consumptionInPeriod ?? []

  return (
    <div className="space-y-4">
      <ReportTableCard
        title={`Stock crítico${critical.length > 0 ? ` (${critical.length})` : ""}`}
        description="Insumos en o bajo su stock mínimo. Es un dato actual, no depende del periodo."
        isLoading={isLoading}
        isEmpty={critical.length === 0}
        emptyMessage="Ningún insumo está por debajo de su stock mínimo."
        onExport={() =>
          downloadCsv(`stock-critico_${suffix}`, critical, [
            { key: "name", header: "Insumo" },
            { key: "category", header: "Categoría" },
            { key: "stock", header: "Stock" },
            { key: "minStock", header: "Mínimo" },
            { key: "unit", header: "Unidad" },
          ])
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {critical.map((row) => (
              <TableRow key={row.itemId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.category}</TableCell>
                <TableCell className="text-right text-destructive">
                  {row.stock} {row.unit}
                </TableCell>
                <TableCell className="text-right">
                  {row.minStock} {row.unit}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTableCard>

      <ReportTableCard
        title="Compras del periodo"
        description={`Total de órdenes no canceladas: ${formatCurrency(data?.purchasesTotal ?? 0)}`}
        isLoading={isLoading}
        isEmpty={purchases.length === 0}
        onExport={() =>
          downloadCsv(`compras_${suffix}`, purchases, [
            { key: "orderId", header: "Orden" },
            { key: "supplierName", header: "Proveedor" },
            { key: "statusLabel", header: "Estado" },
            { key: "createdAt", header: "Fecha" },
            { key: "total", header: "Total" },
          ])
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((row) => (
              <TableRow key={row.orderId}>
                <TableCell className="font-medium">{row.supplierName}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]}>{row.statusLabel}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(row.createdAt, { year: "numeric", month: "short", day: "2-digit" })}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTableCard>

      <ReportTableCard
        title="Consumo del periodo"
        description="Salidas de stock (manuales y por consumo clínico) agrupadas por insumo."
        isLoading={isLoading}
        isEmpty={consumption.length === 0}
        onExport={() =>
          downloadCsv(`consumo_${suffix}`, consumption, [
            { key: "name", header: "Insumo" },
            { key: "quantity", header: "Cantidad" },
            { key: "unit", header: "Unidad" },
          ])
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consumption.map((row) => (
              <TableRow key={row.itemId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right">
                  {row.quantity} {row.unit}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTableCard>
    </div>
  )
}
