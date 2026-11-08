import { useFormContext, useWatch } from "react-hook-form"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { buildEvolutionSeries, computeChartIndicators, POCKET_THRESHOLD_MM } from "../lib/chart-indicators"
import { compareEncounters, today } from "../lib/record"
import type { ClinicalEncounter, RecordFormValues } from "../types/clinical-history.types"
import { PeriodontalEvolutionChart } from "./periodontal-evolution-chart"

function percent(value: number | null) {
  return value === null ? "Sin registro" : `${value}%`
}

function millimeters(value: number | null) {
  return value === null ? "Sin registro" : `${value} mm`
}

export function PeriodontalEvolutionTab({ encounters }: { encounters: ClinicalEncounter[] }) {
  const { control } = useFormContext<RecordFormValues>()
  const chart = useWatch({ control, name: "chart" })
  const indicators = computeChartIndicators(chart)
  // No se deduce del odontograma: es un dato del diagnóstico periodontal de la atención.
  const lostToPerio = [...encounters].sort(compareEncounters).reverse().find((item) => item.periodontalDiagnosis.teethLostToPerio !== null)
    ?.periodontalDiagnosis.teethLostToPerio

  // Un punto por atención (su copia del odontograma) más el estado actual de la historia, aunque no esté guardado.
  const series = buildEvolutionSeries([
    ...[...encounters]
      .sort(compareEncounters)
      .map((encounter) => ({ encounterId: encounter.id, date: encounter.date, chart: encounter.chartSnapshot })),
    { encounterId: null, date: today(), chart },
  ])

  const stats = indicators
    ? [
        { label: "Piezas presentes", value: indicators.presentTeeth },
        { label: "Piezas ausentes", value: indicators.missingTeeth },
        {
          label: "Perdidas por periodontitis",
          value: lostToPerio ?? "Sin registro",
          hint: lostToPerio != null ? "Según el diagnóstico periodontal de la atención" : undefined,
        },
        { label: "Implantes", value: indicators.implants },
        { label: "Piezas con caries", value: indicators.teethWithCaries },
        { label: "Sitios sondeados", value: indicators.sitesProbed },
        { label: `Sitios con bolsa ≥ ${POCKET_THRESHOLD_MM} mm`, value: indicators.sitesWithPocket },
        { label: "Profundidad de sondaje máxima", value: millimeters(indicators.maxProbingDepth) },
        {
          label: "Pérdida de inserción clínica máxima",
          value: millimeters(indicators.maxAttachmentLoss),
          hint: "Profundidad de sondaje + margen gingival",
        },
        { label: "Sitios con recesión (defectos mucogingivales)", value: indicators.sitesWithRecession },
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
          <CardTitle>Indicadores actuales</CardTitle>
          <CardDescription>Calculados a partir del odontograma y el periodontograma de la historia.</CardDescription>
        </CardHeader>
        <CardContent>
          {!indicators ? (
            <p className="text-sm text-muted-foreground">Sin odontograma registrado.</p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                  <dd className="text-lg font-semibold">{stat.value}</dd>
                  {"hint" in stat && stat.hint && <dd className="text-xs text-muted-foreground">{stat.hint}</dd>}
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolución periodontal</CardTitle>
          <CardDescription>
            Comparación de los indicadores entre atenciones. El último punto es el estado actual de la historia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {series.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Se necesitan al menos dos registros con odontograma para mostrar la evolución.
            </p>
          ) : (
            <PeriodontalEvolutionChart data={series} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
