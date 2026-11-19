import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadCsv } from "@/shared/lib/csv"
import { formatPercent } from "@/shared/lib/number"

import { useProductivityReport } from "../api/reports.queries"
import { formatPeriodLabel } from "../lib/period"
import type { ReportPeriod } from "../types/report.types"
import { ReportTableCard } from "./report-table-card"
import { ReportError } from "./report-error"

interface ProductivityReportTabProps {
  period: ReportPeriod
}

export function ProductivityReportTab({ period }: ProductivityReportTabProps) {
  const { data, isLoading: initialLoading, isPlaceholderData, isError } = useProductivityReport(period)
  const isLoading = initialLoading || isPlaceholderData
  const rows = data?.byProfessional ?? []
  const isEmpty = rows.every((row) => row.scheduled === 0)

  return (
    <div className="space-y-4">
      <Card className="report-chart-card">
        <CardHeader>
          <CardTitle>Citas completadas por profesional</CardTitle>
        </CardHeader>
        <CardContent className="report-chart" data-empty={!isLoading && (isError || isEmpty) || undefined}>
          {isError ? <ReportError /> : isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : isEmpty ? <p className="report-chart-empty">Sin citas asignadas a profesionales en el periodo seleccionado.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" accessibilityLayer margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} className="text-xs" width={120} interval={0} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="completed" name="Completadas" fill="var(--success)" radius={[0, 4, 4, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <ReportTableCard
        title="Productividad por profesional"
        isError={isError}
        description="Las sesiones de tratamiento no se atribuyen por profesional: las asignaciones no registran quién las atiende."
        isLoading={isLoading}
        isEmpty={isEmpty}
        onExport={() =>
          downloadCsv(
            `productividad_${formatPeriodLabel(period)}`,
            rows.map((row) => ({ ...row, completionRate: formatPercent(row.completionRate) })),
            [
              { key: "name", header: "Profesional" },
              { key: "specialty", header: "Especialidad" },
              { key: "scheduled", header: "Programadas" },
              { key: "completed", header: "Completadas" },
              { key: "noShow", header: "No asistió" },
              { key: "cancelled", header: "Canceladas" },
              { key: "completionRate", header: "% cumplimiento" },
            ]
          )
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profesional</TableHead>
              <TableHead>Especialidad</TableHead>
              <TableHead className="text-right">Programadas</TableHead>
              <TableHead className="text-right">Completadas</TableHead>
              <TableHead className="text-right">No asistió</TableHead>
              <TableHead className="text-right">Canceladas</TableHead>
              <TableHead className="text-right">% cumplimiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.professionalId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.specialty}</TableCell>
                <TableCell className="text-right">{row.scheduled}</TableCell>
                <TableCell className="text-right">{row.completed}</TableCell>
                <TableCell className="text-right">{row.noShow}</TableCell>
                <TableCell className="text-right">{row.cancelled}</TableCell>
                <TableCell className="text-right font-medium">{formatPercent(row.completionRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTableCard>
    </div>
  )
}
