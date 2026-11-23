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
import { getPresetPeriod } from "../lib/period"
import type { ReportPeriodState } from "../types/report.types"
import "../reports.css"

export function ReportsPage() {
  const [state, setState] = useState<ReportPeriodState>({
    preset: "last30",
    period: getPresetPeriod("last30"),
  })

  return (
    <div className="reports-module space-y-4">
      <PageHeader
        title="Reportes"
        description="Indicadores de agenda, productividad, tratamientos e inventario."
      />

      <PeriodSelector value={state} onChange={setState} />

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
          <AgendaReportTab period={state.period} />
        </TabsContent>
        <TabsContent value="productividad" className="pt-4">
          <ProductivityReportTab period={state.period} />
        </TabsContent>
        <TabsContent value="tratamientos" className="pt-4">
          <TreatmentsReportTab period={state.period} />
        </TabsContent>
        <TabsContent value="inventario" className="pt-4">
          <InventoryReportTab period={state.period} />
        </TabsContent>
      </AdaptiveTabs>
    </div>
  )
}
