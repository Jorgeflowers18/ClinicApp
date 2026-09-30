import { useFormContext, useWatch } from "react-hook-form"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateOnly } from "@/shared/lib/date"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { buildEvolutionSeries, computeChartIndicators, POCKET_THRESHOLD_MM } from "../lib/chart-indicators"
import { compareVisits, resolveProfessionalName } from "../lib/visit"
import { visitStatusLabels, type DentalRecord, type DentalVisit, type VisitFormValues } from "../types/clinical-history.types"
import { PeriodontalEvolutionChart } from "./periodontal-evolution-chart"

interface FollowUpTabProps {
  record: DentalRecord
  visit: DentalVisit
  onOpenVisit: (visitId: string) => void
}

function percent(value: number | null) {
  return value === null ? "Sin registro" : `${value}%`
}

export function FollowUpTab({ record, visit, onOpenVisit }: FollowUpTabProps) {
  const { control } = useFormContext<VisitFormValues>()
  const chart = useWatch({ control, name: "chart" })
  const { data: professionals } = useProfessionals()
  const indicators = computeChartIndicators(chart)

  // El borrador en pantalla aporta su odontograma actual (aún no cerrado) a la evolución.
  const visits = record.visits
    .map((item) => (item.id === visit.id ? { ...item, chart } : item))
    .filter((item) => item.status === "cerrada" || item.id === visit.id)
    .sort(compareVisits)
  const series = buildEvolutionSeries(visits)

  const stats = indicators
    ? [
        { label: "Piezas presentes", value: indicators.presentTeeth },
        { label: "Piezas ausentes", value: indicators.missingTeeth },
        { label: "Implantes", value: indicators.implants },
        { label: "Piezas con caries", value: indicators.teethWithCaries },
        { label: "Sitios sondeados", value: indicators.sitesProbed },
        { label: `Sitios con bolsa ≥ ${POCKET_THRESHOLD_MM} mm`, value: indicators.sitesWithPocket },
        { label: "Sitios con recesión", value: indicators.sitesWithRecession },
        { label: "Sangrado al sondaje", value: percent(indicators.bleedingPercent) },
        { label: "Índice de placa (O'Leary)", value: percent(indicators.plaquePercent) },
        { label: "Piezas con movilidad", value: indicators.teethWithMobility },
        { label: "Piezas con furcación", value: indicators.teethWithFurcation },
        { label: "Piezas con cálculo", value: indicators.teethWithCalculus },
      ]
    : []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Indicadores de esta visita</CardTitle>
          <CardDescription>Calculados a partir del odontograma y el periodontograma registrados.</CardDescription>
        </CardHeader>
        <CardContent>
          {!indicators ? (
            <p className="text-sm text-muted-foreground">Sin odontograma registrado en esta visita.</p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                  <dd className="text-lg font-semibold">{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolución periodontal</CardTitle>
          <CardDescription>Comparación de los indicadores entre visitas.</CardDescription>
        </CardHeader>
        <CardContent>
          {series.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Se necesitan al menos dos visitas con odontograma para mostrar la evolución.
            </p>
          ) : (
            <PeriodontalEvolutionChart data={series} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seguimiento por visita</CardTitle>
          <CardDescription>
            Cada visita conserva su odontograma, mediciones, plan y documentos. Las nuevas visitas parten del último
            estado registrado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...record.visits].sort(compareVisits).reverse().map((item) => (
            <article key={item.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">
                    {formatDateOnly(item.date, { day: "2-digit", month: "long", year: "numeric" })} ·{" "}
                    {item.reason || "Sin motivo registrado"}
                  </h3>
                  <p className="text-xs text-muted-foreground">{resolveProfessionalName(item, professionals)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.status === "borrador" ? "secondary" : "outline"}>{visitStatusLabels[item.status]}</Badge>
                  {item.id !== visit.id && (
                    <Button variant="outline" size="sm" onClick={() => onOpenVisit(item.id)}>
                      Consultar visita
                    </Button>
                  )}
                </div>
              </div>
              {item.diagnosis && (
                <p className="text-sm">
                  <strong>Diagnóstico: </strong>
                  {item.diagnosis}
                </p>
              )}
              {item.evolution && <p className="whitespace-pre-wrap text-sm">{item.evolution}</p>}
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                <strong>Registro periodontal: </strong>
                {item.chart?.summary.periodontalText || "Sin mediciones periodontales registradas."}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.attachments.length} archivos · {item.plan.length} tratamientos en el plan
              </p>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
