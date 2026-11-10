import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, CreditCard, Pencil } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/shared/components/page-header"
import { formatDateOnly } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { useInventoryList } from "@/modules/inventory/api/inventory.queries"
import { usePatientsList } from "@/modules/patients/api/patients.queries"

import {
  useTreatment,
  useTreatmentAssignments,
} from "../api/treatments.queries"
import { useTreatmentFinancialSummary } from "@/modules/finance/api/finance.queries"
import { assignmentPrice, assignmentStatusLabels } from "../types/treatment.types"

export function TreatmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: treatment, isLoading, isError, error } = useTreatment(id)
  const { data: assignments, isLoading: isLoadingAssignments } = useTreatmentAssignments(id)
  const { data: inventoryPage } = useInventoryList({ page: 1, pageSize: 100 })
  const { data: patientsPage } = usePatientsList({ page: 1, pageSize: 100 })
  const { data: financialSummary } = useTreatmentFinancialSummary(id)
  // El enlace a la atención solo sirve a quienes pueden abrir la historia clínica.
  const canOpenHistory = useAuthStore((state) => state.user?.role === "admin" || state.user?.role === "medico")
  const received = [...(assignments ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate))

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError || !treatment) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo cargar el tratamiento</AlertTitle>
        <AlertDescription>{getErrorMessage(error)}</AlertDescription>
      </Alert>
    )
  }

  function itemName(itemId: string) {
    return inventoryPage?.items.find((item) => item.id === itemId)?.name ?? itemId
  }

  function patientName(patientId: string) {
    const patient = patientsPage?.items.find((item) => item.id === patientId)
    return patient ? `${patient.firstName} ${patient.lastName}` : patientId
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/tratamientos")} className="mb-2 -ml-2">
          <ArrowLeft />
          Volver a tratamientos
        </Button>
        <PageHeader
          title={treatment.name}
          description={treatment.category}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate(`/tratamientos/${treatment.id}/editar`)}>
                <Pencil />
                Editar
              </Button>
              <Button variant="secondary" onClick={() => navigate("/finanzas")}>
                <CreditCard />
                Ver finanzas
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Duración</p>
            <p className="text-2xl font-semibold">{treatment.durationMinutes} min</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Precio</p>
            <p className="text-2xl font-semibold">{formatCurrency(treatment.price)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Estado</p>
            <Badge variant={treatment.active ? "default" : "outline"} className="mt-1">
              {treatment.active ? "Activo" : "Inactivo"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {treatment.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Descripción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{treatment.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resumen financiero</CardTitle>
        </CardHeader>
        <CardContent>
          {financialSummary ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <p className="text-sm text-muted-foreground">Valor tratamiento</p>
                <p className="text-xl font-semibold">{formatCurrency(financialSummary.totalValue)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Seguro</p>
                <p className="text-xl font-semibold">{formatCurrency(financialSummary.insuranceCovered)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Responsabilidad paciente</p>
                <p className="text-xl font-semibold">{formatCurrency(financialSummary.patientResponsibility)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagado</p>
                <p className="text-xl font-semibold">{formatCurrency(financialSummary.totalPaid)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendiente</p>
                <p className="text-xl font-semibold">{formatCurrency(financialSummary.pendingBalance)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin información financiera disponible.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consumo de insumos por sesión</CardTitle>
        </CardHeader>
        <CardContent>
          {treatment.consumption.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este tratamiento no consume insumos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {treatment.consumption.map((entry, index) => (
                  <TableRow key={`${entry.itemId}-${index}`}>
                    <TableCell>{itemName(entry.itemId)}</TableCell>
                    <TableCell>{entry.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pacientes que recibieron este tratamiento</CardTitle>
          <CardDescription>
            Los tratamientos se registran desde la atención en la historia clínica del paciente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAssignments ? (
            <Skeleton className="h-24 w-full" />
          ) : received.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Pieza / zona</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead>Estado</TableHead>
                    {canOpenHistory && <TableHead>Atención</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {received.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{patientName(assignment.patientId)}</TableCell>
                      <TableCell>{formatDateOnly(assignment.startDate, { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                      <TableCell>{assignment.tooth || "General"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(assignmentPrice(assignment, treatment.price))}</TableCell>
                      <TableCell>
                        {/* Las asignaciones antiguas con varias sesiones conservan su progreso. */}
                        {assignment.totalSessions > 1 ? (
                          <span className="text-sm">
                            {assignment.completedSessions}/{assignment.totalSessions} sesiones ·{" "}
                            {assignmentStatusLabels[assignment.status]}
                          </span>
                        ) : (
                          <Badge variant="outline">Realizado</Badge>
                        )}
                      </TableCell>
                      {canOpenHistory && (
                        <TableCell>
                          {assignment.sourceEncounterId ? (
                            <Link
                              className="text-sm font-medium hover:underline"
                              to={`/historial-clinico/paciente/${assignment.patientId}?atencion=${assignment.sourceEncounterId}`}
                            >
                              Ver atención
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ningún paciente ha recibido este tratamiento todavía.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
