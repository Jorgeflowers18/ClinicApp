import { useState } from "react"
import { Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/shared/components/page-header"
import { env } from "@/shared/lib/env"

import { AgendaReportTab } from "../components/agenda-report-tab"
import { InventoryReportTab } from "../components/inventory-report-tab"
import { PeriodSelector } from "../components/period-selector"
import { ProductivityReportTab } from "../components/productivity-report-tab"
import { TreatmentsReportTab } from "../components/treatments-report-tab"
import { getPresetPeriod } from "../lib/period"
import type { ReportPeriodState } from "../types/report.types"

export function ReportsPage() {
  const [state, setState] = useState<ReportPeriodState>({
    preset: "last30",
    period: getPresetPeriod("last30"),
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reportes"
        description="Indicadores de agenda, productividad, tratamientos e inventario."
      />

      <PeriodSelector value={state} onChange={setState} />

      {env.useMockApi && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Datos de demostración</AlertTitle>
          <AlertDescription>
            Las citas y notificaciones de ejemplo son relativas a hoy, pero pacientes, asignaciones de tratamiento y
            compras están fechados entre noviembre de 2025 y febrero de 2026. Usa "Este año" o un rango personalizado
            para verlos.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="agenda">
        <TabsList>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="productividad">Productividad</TabsTrigger>
          <TabsTrigger value="tratamientos">Tratamientos</TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  )
}
