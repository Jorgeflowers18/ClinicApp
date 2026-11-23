import { useState } from "react"
import { CalendarDays, ChartNoAxesCombined, Stethoscope, Package } from "lucide-react"

import { AdaptiveTabs } from "@/components/ui/adaptive-tabs"
import { TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/shared/components/page-header"

import { AgendaReportTab } from "../components/agenda-report-tab"
import { InventoryReportTab } from "../components/inventory-report-tab"
import { PeriodSelector } from "../components/period-selector"
import { ProductivityReportTab } from "../components/productivity-report-tab"
import { TreatmentsReportTab } from "../components/treatments-report-tab"
import { useReportsSummary } from "../api/reports.queries"
import { getPresetPeriod, periodError, serverPeriodError } from "../lib/period"
import type { ReportPeriod, ReportPeriodState } from "../types/report.types"
import "../reports.css"

export function ReportsPage() {
  const [state, setState] = useState<ReportPeriodState>({
    preset: "last30",
    period: getPresetPeriod("last30"),
  })
  // Las pestañas usan el último periodo válido: uno inválido (más de 366 días, o la fecha final antes de la
  // inicial) no se pide al servidor y su error queda junto al selector.
  const [applied, setApplied] = useState<ReportPeriod>(state.period)
  const invalid = periodError(state.period)
  // Misma consulta que la pestaña Agenda (se comparte la caché): si el servidor rechaza el periodo, su mensaje
  // también va junto al selector.
  const summary = useReportsSummary(applied)
  const error = invalid ?? serverPeriodError(summary.error)

  function changePeriod(next: ReportPeriodState) {
    setState(next)
    if (!periodError(next.period)) setApplied(next.period)
  }

  return (
    <div className="reports-module space-y-4">
      <PageHeader
        title="Reportes"
        description="Indicadores de agenda, productividad, tratamientos e inventario."
      />

      <PeriodSelector value={state} onChange={changePeriod} error={error} />

      <AdaptiveTabs
        variant="line"
        defaultValue="agenda"
        items={[
          { value: "agenda", label: <><CalendarDays aria-hidden="true" />Agenda</>, accessibleLabel: "Agenda" },
          { value: "productividad", label: <><ChartNoAxesCombined aria-hidden="true" />Productividad</>, accessibleLabel: "Productividad" },
          { value: "tratamientos", label: <><Stethoscope aria-hidden="true" />Tratamientos</>, accessibleLabel: "Tratamientos" },
          { value: "inventario", label: <><Package aria-hidden="true" />Inventario</>, accessibleLabel: "Inventario" },
        ]}
      >
        <TabsContent value="agenda" className="pt-4">
          <AgendaReportTab period={applied} />
        </TabsContent>
        <TabsContent value="productividad" className="pt-4">
          <ProductivityReportTab period={applied} />
        </TabsContent>
        <TabsContent value="tratamientos" className="pt-4">
          <TreatmentsReportTab period={applied} />
        </TabsContent>
        <TabsContent value="inventario" className="pt-4">
          <InventoryReportTab period={applied} />
        </TabsContent>
      </AdaptiveTabs>
    </div>
  )
}
