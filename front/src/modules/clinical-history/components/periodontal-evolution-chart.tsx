import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { EvolutionPoint } from "../lib/chart-indicators"

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  borderColor: "var(--border)",
  borderRadius: 8,
  fontSize: 12,
}

/**
 * Evolución de indicadores entre visitas. Porcentajes y conteos van en gráficos separados para no
 * mezclar unidades en un mismo eje.
 */
export function PeriodontalEvolutionChart({ data }: { data: EvolutionPoint[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <figure className="space-y-2">
        <figcaption className="text-sm font-medium">Sangrado al sondaje y placa (%)</figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis tickLine={false} axisLine={false} className="text-xs" domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="bleedingPercent"
                name="Sangrado al sondaje"
                stroke="var(--destructive)"
                strokeWidth={2}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="plaquePercent"
                name="Placa (O'Leary)"
                stroke="var(--primary)"
                strokeWidth={2}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <figure className="space-y-2">
        <figcaption className="text-sm font-medium">Hallazgos por visita</figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
              <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="sitesWithPocket" name="Sitios con bolsa ≥ 4 mm" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="teethWithMobility" name="Piezas con movilidad" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="teethWithCaries" name="Piezas con caries" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  )
}
