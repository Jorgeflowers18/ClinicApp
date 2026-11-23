import { ArrowUpRight, CreditCard, DollarSign } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/shared/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency } from "@/shared/lib/number"
import { KpiCard } from "@/modules/reports/components/kpi-card"

import { useFinancialPortfolio } from "../api/finance.queries"
import { ActivePortfolio } from "../components/active-portfolio"
import "../finance.css"

export function FinancePage() {
  const navigate = useNavigate()
  const { data: rows = [], isLoading, isError } = useFinancialPortfolio()

  const totalPending = rows.reduce((sum, row) => sum + row.pending, 0)
  const totalPaid = rows.reduce((sum, row) => sum + row.paid, 0)

  return (
    <div className="finance-module space-y-4">
      <PageHeader
        title="Finanzas"
        description="Gestiona la cartera y los pagos."
        actions={
          <Button variant="outline" onClick={() => navigate("/tratamientos")}>
            <ArrowUpRight aria-hidden="true" className="size-4" />
            Ver tratamientos
          </Button>
        }
      />

      {isError ? <Alert variant="destructive"><AlertDescription>No se pudo cargar la información financiera. Vuelve a intentarlo más tarde.</AlertDescription></Alert> : <>
      {/* Vencimientos, mora y seguros dependen del financiamiento de cada clínica (ítem 8 del backlog): no se muestran. */}
      <div className="finance-metrics">
        <KpiCard label="Cobrado este mes" value={formatCurrency(totalPaid)} icon={DollarSign} iconTone="success" isLoading={isLoading} hintMode="popover" hint="El importe disponible corresponde a todos los pagos registrados en la cartera; actualmente no está limitado al mes en curso." />
        <KpiCard label="Total pendiente" value={formatCurrency(totalPending)} icon={CreditCard} iconTone="warning" isLoading={isLoading} />
      </div>

      <Card className="finance-portfolio-card">
        <CardHeader>
          <CardTitle>Cartera activa</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 px-0 pb-4">
          {isLoading ? <p className="px-4 py-6 text-sm text-muted-foreground" role="status">Cargando cartera…</p> : <ActivePortfolio rows={rows} />}
        </CardContent>
      </Card>

      </>}
    </div>
  )
}
