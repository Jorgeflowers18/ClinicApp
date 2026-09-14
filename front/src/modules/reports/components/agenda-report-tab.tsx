import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { CalendarCheck, CalendarX, CheckCircle2, Percent } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadCsv } from "@/shared/lib/csv"
import { formatPercent } from "@/shared/lib/number"

import { useAgendaReport, useReportsSummary } from "../api/reports.queries"
import { formatPeriodLabel } from "../lib/period"
import type { ReportPeriod } from "../types/report.types"
import { KpiCard } from "./kpi-card"
import { ReportTableCard } from "./report-table-card"

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

interface AgendaReportTabProps {
  period: ReportPeriod
}

export function AgendaReportTab({ period }: AgendaReportTabProps) {
  const { data: summary, isLoading: isLoadingSummary } = useReportsSummary(period)
  const { data: agenda, isLoading } = useAgendaReport(period)
  const suffix = formatPeriodLabel(period)

  const chartData = (agenda?.byDay ?? []).map((row) => ({
    ...row,
    otras: row.total - row.completadas - row.noShow,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Citas en el periodo" value={summary?.appointmentsInPeriod ?? 0} icon={CalendarCheck} isLoading={isLoadingSummary} />
        <KpiCard label="Completadas" value={summary?.appointmentsCompleted ?? 0} icon={CheckCircle2} isLoading={isLoadingSummary} />
        <KpiCard label="No asistió" value={summary?.appointmentsNoShow ?? 0} icon={CalendarX} isLoading={isLoadingSummary} />
        <KpiCard
          label="Tasa de no-show"
          value={formatPercent(summary?.noShowRate ?? 0)}
          hint="Sobre citas completadas + no asistidas"
          icon={Percent}
          isLoading={isLoadingSummary}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Citas por día</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" interval="preserveStartEnd" />
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
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completadas" name="Completadas" stackId="citas" fill="var(--primary)" />
                <Bar dataKey="noShow" name="No asistió" stackId="citas" fill="var(--destructive)" />
                <Bar dataKey="otras" name="Otras" stackId="citas" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportTableCard
          title="Citas por estado"
          isLoading={isLoading}
          isEmpty={!agenda || agenda.byStatus.every((row) => row.count === 0)}
          onExport={() =>
            downloadCsv(`agenda-por-estado_${suffix}`, agenda?.byStatus ?? [], [
              { key: "label", header: "Estado" },
              { key: "count", header: "Citas" },
            ])
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Citas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agenda?.byStatus.map((row) => (
                <TableRow key={row.status}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right font-medium">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportTableCard>

        <ReportTableCard
          title="Ocupación por consultorio"
          description="Tiempo reservado por citas no canceladas y tiempo bloqueado."
          isLoading={isLoading}
          isEmpty={!agenda || agenda.occupancyByRoom.every((row) => row.appointments === 0 && row.blockedMinutes === 0)}
          onExport={() =>
            downloadCsv(`ocupacion-consultorios_${suffix}`, agenda?.occupancyByRoom ?? [], [
              { key: "roomName", header: "Consultorio" },
              { key: "appointments", header: "Citas" },
              { key: "bookedMinutes", header: "Minutos reservados" },
              { key: "blockedMinutes", header: "Minutos bloqueados" },
            ])
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultorio</TableHead>
                <TableHead className="text-right">Citas</TableHead>
                <TableHead className="text-right">Reservado</TableHead>
                <TableHead className="text-right">Bloqueado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agenda?.occupancyByRoom.map((row) => (
                <TableRow key={row.roomId || "none"}>
                  <TableCell>{row.roomName}</TableCell>
                  <TableCell className="text-right">{row.appointments}</TableCell>
                  <TableCell className="text-right">{formatMinutes(row.bookedMinutes)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatMinutes(row.blockedMinutes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportTableCard>
      </div>
    </div>
  )
}
