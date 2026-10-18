import { ArrowUpRight, CreditCard, DollarSign, ReceiptText, ShieldCheck } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/shared/components/page-header"
import { formatDateOnly } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"

import { useFinancialPortfolio } from "../api/finance.queries"

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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Cobrado este mes</span>
              <DollarSign className="size-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total pendiente</span>
              <CreditCard className="size-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(totalPending)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total vencido</span>
              <ReceiptText className="size-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(totalOverdue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Seguros pendientes</span>
              <ShieldCheck className="size-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{dueSoon}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cartera activa</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 px-0 pb-4">
          <div
            role="region"
            aria-label="Cartera activa, tabla desplazable horizontalmente"
            tabIndex={0}
            className="min-w-0 overflow-x-auto px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <div className="min-w-[56rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Tratamiento</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pagado</TableHead>
                    <TableHead>Pendiente</TableHead>
                    <TableHead>Vencido</TableHead>
                    <TableHead>Próximo venc.</TableHead>
                    <TableHead>Días mora</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={`${row.patientId}-${row.treatmentId}`}>
                      <TableCell>{row.patientName}</TableCell>
                      <TableCell>{row.treatmentName}</TableCell>
                      <TableCell>{formatCurrency(row.total)}</TableCell>
                      <TableCell>{formatCurrency(row.paid)}</TableCell>
                      <TableCell>{formatCurrency(row.pending)}</TableCell>
                      <TableCell>{formatCurrency(row.overdue)}</TableCell>
                      <TableCell>
                        {row.nextDueDate
                          ? formatDateOnly(row.nextDueDate, { year: "numeric", month: "short", day: "numeric" })
                          : "—"}
                      </TableCell>
                      <TableCell>{row.daysLate}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "vencida"
                              ? "destructive"
                              : row.status === "parcial"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {row.status === "al_dia" ? "Al día" : row.status === "parcial" ? "Parcial" : "Vencida"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
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
