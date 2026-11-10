import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { DataTableColumn } from "@/shared/components/data-table"
import { formatDateOnly } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"

import type { FinancialPortfolioRow } from "../types/finance.types"

// Both presentations use the same fields, order and formatters.
const columns: DataTableColumn<FinancialPortfolioRow>[] = [
  { key: "patientName", header: "Paciente", cell: (row) => row.patientName },
  { key: "treatmentName", header: "Tratamiento", cell: (row) => row.treatmentName },
  { key: "total", header: "Total", cell: (row) => formatCurrency(row.total) },
  { key: "paid", header: "Pagado", cell: (row) => formatCurrency(row.paid) },
  { key: "pending", header: "Pendiente", cell: (row) => formatCurrency(row.pending) },
  { key: "overdue", header: "Vencido", cell: (row) => formatCurrency(row.overdue) },
  {
    key: "nextDueDate", header: "Próximo venc.",
    cell: (row) => row.nextDueDate
      ? formatDateOnly(row.nextDueDate, { year: "numeric", month: "short", day: "numeric" })
      : "—",
  },
  { key: "daysLate", header: "Días mora", cell: (row) => row.daysLate },
  {
    key: "status", header: "Estado",
    cell: (row) => (
      <Badge variant={row.status === "vencida" ? "destructive" : row.status === "parcial" ? "secondary" : "outline"}>
        {row.status === "al_dia" ? "Al día" : row.status === "parcial" ? "Parcial" : "Vencida"}
      </Badge>
    ),
  },
]
const details = columns.slice(1)

export function ActivePortfolio({ rows }: { rows: FinancialPortfolioRow[] }) {
  return (
    <div data-slot="active-portfolio" className="@container/portfolio min-w-0">
      {/* 56rem of table plus its existing 3rem of horizontal padding. */}
      <div
        role="region"
        aria-label="Cartera activa, tabla desplazable horizontalmente"
        tabIndex={0}
        className="hidden min-w-0 overflow-x-auto px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @[59rem]/portfolio:block"
      >
        <div className="min-w-[56rem]">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => <TableHead key={column.key}>{column.header}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.patientId}-${row.treatmentId}`}>
                  {columns.map((column) => <TableCell key={column.key}>{column.cell(row)}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <ul aria-label="Registros de cartera activa" className="grid min-w-0 grid-cols-1 gap-3 px-4 @[59rem]/portfolio:hidden">
        {rows.map((row) => {
          const id = `portfolio-${row.patientId}-${row.treatmentId}`
          return (
            <li key={`${row.patientId}-${row.treatmentId}`} className="min-w-0">
              <article aria-labelledby={id} className="min-w-0 space-y-4 rounded-xl border bg-card p-4 text-card-foreground">
                <h3 id={id} className="min-w-0 text-base font-semibold leading-snug [overflow-wrap:anywhere]">
                  {row.patientName}
                </h3>
                <dl className="space-y-3 text-sm">
                  {details.map((column) => (
                    <div
                      key={column.key}
                      className={column.key === "treatmentName"
                        ? "grid min-w-0 grid-cols-1 gap-1"
                        : "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3"}
                    >
                      <dt className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">{column.header}</dt>
                      <dd className={column.key === "treatmentName"
                        ? "min-w-0 [overflow-wrap:anywhere]"
                        : "min-w-0 text-right font-medium tabular-nums [overflow-wrap:anywhere]"}
                      >
                        {column.cell(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
