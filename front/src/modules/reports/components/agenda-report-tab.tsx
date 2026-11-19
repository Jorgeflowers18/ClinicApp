import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { CalendarCheck, CalendarX, CheckCircle2, Percent } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadCsv } from "@/shared/lib/csv"
import { formatPercent } from "@/shared/lib/number"
import { formatDateOnly } from "@/shared/lib/date"

import { useAgendaReport, useReportsSummary } from "../api/reports.queries"
import { formatPeriodLabel } from "../lib/period"
import type { ReportPeriod } from "../types/report.types"
import { KpiCard } from "./kpi-card"
import { ReportTableCard } from "./report-table-card"
import { ReportError } from "./report-error"

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
  const summaryQuery = useReportsSummary(period)
  const { data: summary } = summaryQuery
  const isLoadingSummary = summaryQuery.isLoading || summaryQuery.isPlaceholderData
  const { data: agenda, isLoading: initialLoading, isPlaceholderData, isError } = useAgendaReport(period)
  const isLoading = initialLoading || isPlaceholderData
  const suffix = formatPeriodLabel(period)

  const chartData = (agenda?.byDay ?? []).map((row) => ({
    ...row,
    otras: row.total - row.completadas - row.noShow,
  }))

  return (
    <div className="space-y-4">
      {summaryQuery.isError ? <ReportError /> : <div className="reports-kpis">
        <KpiCard label="Citas en el periodo" value={summary?.appointmentsInPeriod ?? 0} icon={CalendarCheck} isLoading={isLoadingSummary} />
        <KpiCard label="Completadas" value={summary?.appointmentsCompleted ?? 0} icon={CheckCircle2} iconTone="success" isLoading={isLoadingSummary} />
        <KpiCard label="No asistió" value={summary?.appointmentsNoShow ?? 0} icon={CalendarX} iconTone="destructive" isLoading={isLoadingSummary} />
        <KpiCard
          label="Tasa de inasistencia"
          value={formatPercent(summary?.noShowRate ?? 0)}
          hint="Sobre citas completadas + no asistidas. Cuando no hay citas evaluables, el cálculo actual muestra 0%; no implica un cumplimiento confirmado."
          hintMode="popover"
          icon={Percent}
          isLoading={isLoadingSummary}
        />
      </div>}

      <Card className="report-chart-card">
        <CardHeader>
          <CardTitle>Citas por día</CardTitle>
        </CardHeader>
        <CardContent className="report-chart" data-empty={!isLoading && (isError || chartData.every(row => row.total === 0)) || undefined}>
          {isError ? <ReportError /> : isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : chartData.every(row => row.total === 0) ? <p className="report-chart-empty">Sin citas en el periodo seleccionado.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} accessibilityLayer margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" interval="preserveStartEnd" minTickGap={30} />
                <YAxis tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                <Tooltip
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.date ? formatDateOnly(payload[0].payload.date, { day: "numeric", month: "long", year: "numeric" }) : label}
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completadas" name="Completadas" stackId="citas" fill="var(--success)" />
                <Bar dataKey="noShow" name="No asistió" stackId="citas" fill="var(--destructive)" />
                <Bar dataKey="otras" name="Otras" stackId="citas" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="report-agenda-tables">
        <ReportTableCard
          title="Citas por estado"
          isError={isError}
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
          isError={isError}
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
