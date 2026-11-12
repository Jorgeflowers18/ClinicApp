import { ArrowUpRight, CreditCard, DollarSign, ReceiptText, ShieldCheck } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/shared/components/page-header"
import { formatCurrency } from "@/shared/lib/number"
import { KpiCard } from "@/modules/reports/components/kpi-card"

import { useFinancialPortfolio } from "../api/finance.queries"
import { ActivePortfolio } from "../components/active-portfolio"

export function FinancePage() {
  const navigate = useNavigate()
  const { data: rows = [], isLoading } = useFinancialPortfolio()

  const totalPending = rows.reduce((sum, row) => sum + row.pending, 0)
  const totalOverdue = rows.reduce((sum, row) => sum + row.overdue, 0)
  const totalPaid = rows.reduce((sum, row) => sum + row.paid, 0)
  const dueSoon = rows.filter((row) => row.nextDueDate).length

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando finanzas…</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        description="Cartera, pagos, cuotas, seguros y facturación del tratamiento."
        actions={
          <Button variant="outline" onClick={() => navigate("/tratamientos")}>
            Ver tratamientos
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Cobrado este mes" value={formatCurrency(totalPaid)} icon={DollarSign} iconTone="success" />
        <KpiCard label="Total pendiente" value={formatCurrency(totalPending)} icon={CreditCard} />
        <KpiCard label="Total vencido" value={formatCurrency(totalOverdue)} icon={ReceiptText} iconTone="destructive" />
        <KpiCard label="Seguros pendientes" value={dueSoon} icon={ShieldCheck} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cartera activa</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 px-0 pb-4">
          <ActivePortfolio rows={rows} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate("/tratamientos")}>
          <ArrowUpRight className="size-4" />
          Ir a tratamientos
        </Button>
      </div>
    </div>
  )
}
