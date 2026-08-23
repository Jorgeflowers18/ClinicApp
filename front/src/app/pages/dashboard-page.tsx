import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { CalendarCheck, Package, Stethoscope, Users } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/shared/components/page-header"
import { useAuthStore } from "@/modules/auth/store/auth-store"

const weeklyAppointments = [
  { day: "Lun", citas: 8 },
  { day: "Mar", citas: 12 },
  { day: "Mié", citas: 10 },
  { day: "Jue", citas: 14 },
  { day: "Vie", citas: 9 },
  { day: "Sáb", citas: 5 },
]

const stats = [
  { label: "Pacientes activos", value: "5", icon: Users },
  { label: "Citas esta semana", value: "58", icon: CalendarCheck },
  { label: "Tratamientos en curso", value: "12", icon: Stethoscope },
  { label: "Insumos bajo mínimo", value: "3", icon: Package },
]

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hola, ${user?.name?.split(" ")[0] ?? ""}`}
        description="Resumen general de la actividad de la clínica."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-semibold">{stat.value}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <stat.icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Citas de la semana</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyAppointments}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs" />
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
              <Bar dataKey="citas" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
