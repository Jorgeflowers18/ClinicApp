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

interface ProductivityReportTabProps {
  period: ReportPeriod
}

export function ProductivityReportTab({ period }: ProductivityReportTabProps) {
  const { data, isLoading } = useProductivityReport(period)
  const rows = data?.byProfessional ?? []
  const isEmpty = rows.every((row) => row.scheduled === 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Citas completadas por profesional</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="completed" name="Completadas" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <ReportTableCard
        title="Productividad por profesional"
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
