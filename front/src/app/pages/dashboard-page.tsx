import { useMemo } from "react"
import { Link } from "react-router-dom"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { BarChart3, CalendarCheck, Package, Stethoscope, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/shared/components/page-header"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { useAgendaReport, useReportsSummary } from "@/modules/reports/api/reports.queries"
import { KpiCard } from "@/modules/reports/components/kpi-card"
import { getPresetPeriod } from "@/modules/reports/lib/period"

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === "admin"

  const period = useMemo(() => getPresetPeriod("month"), [])
  const { data: summary, isLoading: isLoadingSummary } = useReportsSummary(period)
  const { data: agenda, isLoading: isLoadingAgenda } = useAgendaReport(period)

  return (
    <div className="clinic-pilot clinic-pilot-page clinic-dashboard-page space-y-6">
      <PageHeader
        className="clinic-pilot-header"
        title={`Hola, ${user?.name?.split(" ")[0] ?? ""}`}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Pacientes registrados"
          value={summary?.patientsTotal ?? 0}
          icon={Users}
          isLoading={isLoadingSummary}
          className="clinic-pilot-card"
          iconClassName="clinic-kpi-icon"
        />
        <KpiCard
          label="Citas este mes"
          value={summary?.appointmentsInPeriod ?? 0}
          hint={`${summary?.appointmentsCompleted ?? 0} completadas`}
          icon={CalendarCheck}
          isLoading={isLoadingSummary}
          className="clinic-pilot-card"
          iconClassName="clinic-kpi-icon"
        />
        <KpiCard
          label="Tratamientos en curso"
          value={summary?.activeTreatments ?? 0}
          icon={Stethoscope}
          isLoading={isLoadingSummary}
          className="clinic-pilot-card"
          iconClassName="clinic-kpi-icon"
        />
        <KpiCard
          label="Insumos bajo mínimo"
          value={summary?.criticalStockItems ?? 0}
          icon={Package}
          isLoading={isLoadingSummary}
          className="clinic-pilot-card"
          iconClassName="clinic-kpi-icon"
        />
      </div>

      <Card className="clinic-pilot-card">
        <CardHeader>
          <CardTitle>Citas del mes</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {isLoadingAgenda ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agenda?.byDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--clinic-border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--clinic-text-muted)", fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--clinic-text-muted)", fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    backgroundColor: "var(--clinic-surface)",
                    borderColor: "var(--clinic-border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--clinic-text)",
                  }}
                />
                <Bar dataKey="total" name="Citas" fill="var(--clinic-data)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
