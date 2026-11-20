import { InventoryStockStatus, InventoryStatus, StockQuantity } from "@/modules/inventory/components/inventory-presentation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadCsv } from "@/shared/lib/csv"
import { formatDateTime } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import type { PurchaseOrderStatus } from "@/modules/inventory/types/inventory.types"

import { useInventoryReport } from "../api/reports.queries"
import { formatPeriodLabel } from "../lib/period"
import type { ReportPeriod } from "../types/report.types"
import { ReportTableCard } from "./report-table-card"

const STATUS_TONE: Record<PurchaseOrderStatus, "warning" | "success" | "danger"> = {
  pendiente: "warning",
  recibida: "success",
  cancelada: "danger",
}

interface InventoryReportTabProps {
  period: ReportPeriod
}

export function InventoryReportTab({ period }: InventoryReportTabProps) {
  const { data, isLoading: initialLoading, isPlaceholderData, isError } = useInventoryReport(period)
  const isLoading = initialLoading || isPlaceholderData
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
        isError={isError}
        isEmpty={critical.length === 0}
        emptyMessage="Ningún insumo está en el mínimo o por debajo."
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
              <TableHead className="text-right">Stock actual</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {critical.map((row) => (
              <TableRow key={row.itemId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.category}</TableCell>
                <TableCell className="text-right">
                  <StockQuantity quantity={row.stock} unit={row.unit} />
                </TableCell>
                <TableCell className="text-right">
                  <StockQuantity quantity={row.minStock} unit={row.unit} secondary />
                </TableCell>
                <TableCell><InventoryStockStatus item={row} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTableCard>

      <ReportTableCard
        title="Compras del periodo"
        isError={isError}
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
                  <InventoryStatus label={row.statusLabel} tone={STATUS_TONE[row.status]} />
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
        isError={isError}
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
                  <StockQuantity quantity={row.quantity} unit={row.unit} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTableCard>
    </div>
  )
}
