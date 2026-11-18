import { useMemo } from "react"
import { Link } from "react-router-dom"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { BarChart3, CalendarCheck, Package, Stethoscope, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/shared/components/page-header"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { userDisplayName } from "@/modules/auth/components/user-identity"
import { useAgendaReport, useReportsSummary } from "@/modules/reports/api/reports.queries"
import { KpiCard } from "@/modules/reports/components/kpi-card"
import { getPresetPeriod } from "@/modules/reports/lib/period"
import { formatDateOnly } from "@/shared/lib/date"
import styles from "./dashboard-page.module.css"

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === "admin"

  const period = useMemo(() => getPresetPeriod("month"), [])
  const { data: summary, isLoading: isLoadingSummary, isError: isSummaryError, refetch: refetchSummary } = useReportsSummary(period)
  const { data: agenda, isLoading: isLoadingAgenda, isError: isAgendaError, refetch: refetchAgenda } = useAgendaReport(period)
  const completed = summary?.appointmentsCompleted ?? 0
  const needsStock = !!summary && summary.criticalStockItems > 0
  const monthLabel = formatDateOnly(period.from, { month: "long", year: "numeric" })
  const summaryUnavailable = isSummaryError && !summary

  return (
    <div className={`clinic-pilot clinic-pilot-page clinic-dashboard-page ${styles.dashboard}`}>
      <PageHeader
        className={`clinic-pilot-header ${styles.header}`}
        title={`Hola, ${userDisplayName(user).split(/\s+/)[0]}`}
        description="Resumen general de la actividad de la clínica."
        actions={
          isAdmin ? (
            <Button className="clinic-pilot-primary-button" nativeButton={false} render={<Link to="/reportes" />}>
              <BarChart3 />
              Ver reportes
            </Button>
          ) : undefined
        }
      />

      {isSummaryError && (
        <div className={styles.notice} role="alert">
          <p>{summary ? "No se pudieron actualizar los indicadores. Se muestran los últimos datos disponibles." : "No se pudieron cargar los indicadores."}</p>
          <Button variant="outline" size="sm" onClick={() => refetchSummary()}>Reintentar</Button>
        </div>
      )}

      <div className={styles.kpis} role="group" aria-label="Indicadores de la clínica" aria-busy={isLoadingSummary}>
        <KpiCard
          label="Pacientes registrados"
          value={summaryUnavailable ? "—" : summary?.patientsTotal ?? 0}
          icon={Users}
          isLoading={isLoadingSummary}
          className="clinic-pilot-card"
          layout="split"
        />
        <KpiCard
          label="Citas este mes"
          value={summaryUnavailable ? "—" : summary?.appointmentsInPeriod ?? 0}
          hint={summaryUnavailable ? undefined : `${completed} ${completed === 1 ? "completada" : "completadas"}`}
          icon={CalendarCheck}
          isLoading={isLoadingSummary}
          className={`clinic-pilot-card ${styles.appointments}`}
          layout="split"
        />
        <KpiCard
          label="Tratamientos en curso"
          value={summaryUnavailable ? "—" : summary?.activeTreatments ?? 0}
          icon={Stethoscope}
          iconTone="success"
          isLoading={isLoadingSummary}
          className="clinic-pilot-card"
          layout="split"
        />
        <KpiCard
          label="Insumos bajo mínimo"
          iconTone={needsStock ? "warning" : "neutral"}
          value={summaryUnavailable ? "—" : summary?.criticalStockItems ?? 0}
          hint={needsStock ? "Reabastecer" : undefined}
          icon={Package}
          isLoading={isLoadingSummary}
          className={`clinic-pilot-card ${needsStock ? styles.needsAttention : ""}`}
          layout="split"
        />
      </div>

      <Card className={`clinic-pilot-card ${styles.chart}`} role="region" aria-labelledby="dashboard-chart-title">
        <CardHeader className={styles.chartHeader}>
          <div>
            <CardTitle><h2 id="dashboard-chart-title">Citas del mes</h2></CardTitle>
            <p className={styles.chartDescription}>Distribución diaria · <time dateTime={period.from}>{monthLabel}</time></p>
          </div>
          {!isLoadingSummary && summary && (
            <p className={styles.chartTotal}><strong>{summary.appointmentsInPeriod}</strong><span>{summary.appointmentsInPeriod === 1 ? "cita en el mes" : "citas en el mes"}</span></p>
          )}
        </CardHeader>
        <CardContent className={styles.chartContent}>
          {isAgendaError && (
            <div className={styles.notice} role="alert">
              <p>{agenda ? "No se pudo actualizar el gráfico. Se muestran los últimos datos disponibles." : "No se pudieron cargar las citas del mes."}</p>
              <Button variant="outline" size="sm" onClick={() => refetchAgenda()}>Reintentar</Button>
            </div>
          )}
          <div className={styles.chartCanvas} aria-busy={isLoadingAgenda} hidden={isAgendaError && !agenda}>
          {isLoadingAgenda ? (
            <div className={styles.chartLoading} role="status" aria-label="Cargando citas del mes"><Skeleton className="h-full w-full" /></div>
          ) : agenda && agenda.byDay.some((day) => day.total > 0) ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={agenda.byDay} accessibilityLayer aria-label="Citas del mes por día" margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={28} tickMargin={10} />
                <YAxis width={30} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} allowDecimals={false} tickMargin={8} />
                <Tooltip
                  isAnimationActive={false}
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--popover-foreground)",
                    boxShadow: "var(--shadow-popover)",
                  }}
                  itemStyle={{ color: "var(--foreground)" }}
                  labelFormatter={(label, payload) => payload[0]?.payload?.date ? formatDateOnly(payload[0].payload.date, { weekday: "long", day: "numeric", month: "long" }) : label}
                  formatter={(value) => [value, Number(value) === 1 ? "Cita" : "Citas"]}
                />
                <Bar dataKey="total" name="Citas" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : !isAgendaError && agenda ? (
            <div className={styles.empty} role="status"><CalendarCheck aria-hidden="true" /><p>No hay citas registradas este mes.</p><span>Las citas aparecerán aquí cuando se programen.</span></div>
          ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
