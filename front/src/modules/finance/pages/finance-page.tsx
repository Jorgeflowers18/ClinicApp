import { ArrowUpRight, CreditCard, DollarSign, ReceiptText, ShieldCheck } from "lucide-react"
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
  const totalOverdue = rows.reduce((sum, row) => sum + row.overdue, 0)
  const totalPaid = rows.reduce((sum, row) => sum + row.paid, 0)
  const dueSoon = rows.filter((row) => row.nextDueDate).length

  return (
    <div className="finance-module space-y-4">
      <PageHeader
        title="Finanzas"
        description="Gestiona la cartera, pagos y seguros."
        actions={
          <Button variant="outline" onClick={() => navigate("/tratamientos")}>
            <ArrowUpRight aria-hidden="true" className="size-4" />
            Ver tratamientos
          </Button>
        }
      />

      {isError ? <Alert variant="destructive"><AlertDescription>No se pudo cargar la información financiera. Vuelve a intentarlo más tarde.</AlertDescription></Alert> : <>
      <div className="finance-metrics">
        <KpiCard label="Cobrado este mes" value={formatCurrency(totalPaid)} icon={DollarSign} iconTone="success" isLoading={isLoading} hintMode="popover" hint="El importe disponible corresponde a todos los pagos registrados en la cartera; actualmente no está limitado al mes en curso." />
        <KpiCard label="Total pendiente" value={formatCurrency(totalPending)} icon={CreditCard} iconTone="warning" isLoading={isLoading} />
        <KpiCard label="Total vencido" value={formatCurrency(totalOverdue)} icon={ReceiptText} iconTone={totalOverdue > 0 ? "destructive" : "neutral"} isLoading={isLoading} />
        <KpiCard label="Seguros pendientes" value={dueSoon} icon={ShieldCheck} isLoading={isLoading} hintMode="popover" hint="El contador disponible corresponde a tratamientos con un próximo vencimiento registrado. No representa una confirmación de cobertura ni de deuda de una aseguradora." />
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
