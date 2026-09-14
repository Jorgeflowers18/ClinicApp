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
    <div className="space-y-6">
      <PageHeader
        title={`Hola, ${user?.name?.split(" ")[0] ?? ""}`}
        description="Resumen general de la actividad de la clínica."
        actions={
          isAdmin ? (
            <Button variant="outline" nativeButton={false} render={<Link to="/reportes" />}>
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
        />
        <KpiCard
          label="Citas este mes"
          value={summary?.appointmentsInPeriod ?? 0}
          hint={`${summary?.appointmentsCompleted ?? 0} completadas`}
          icon={CalendarCheck}
          isLoading={isLoadingSummary}
        />
        <KpiCard
          label="Tratamientos en curso"
          value={summary?.activeTreatments ?? 0}
          icon={Stethoscope}
          isLoading={isLoadingSummary}
        />
        <KpiCard
          label="Insumos bajo mínimo"
          value={summary?.criticalStockItems ?? 0}
          icon={Package}
          isLoading={isLoadingSummary}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Citas del mes</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {isLoadingAgenda ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agenda?.byDay ?? []}>
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
                <Bar dataKey="total" name="Citas" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
