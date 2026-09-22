import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, CreditCard, Pencil, Plus } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/shared/components/page-header"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useInventoryList } from "@/modules/inventory/api/inventory.queries"
import { usePatientsList } from "@/modules/patients/api/patients.queries"

import {
  useAdvanceSession,
  useTreatment,
  useTreatmentAssignments,
} from "../api/treatments.queries"
import { useTreatmentFinancialSummary } from "@/modules/finance/api/finance.queries"
import { assignmentStatusLabels } from "../types/treatment.types"

export function TreatmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: treatment, isLoading, isError, error } = useTreatment(id)
  const { data: assignments, isLoading: isLoadingAssignments } = useTreatmentAssignments(id)
  const { data: inventoryPage } = useInventoryList({ page: 1, pageSize: 100 })
  const { data: patientsPage } = usePatientsList({ page: 1, pageSize: 100 })
  const { data: financialSummary } = useTreatmentFinancialSummary(id)
  const advanceSession = useAdvanceSession(id ?? "")

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
            <p className="text-2xl font-semibold">${treatment.price.toFixed(2)}</p>
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
                <p className="text-xl font-semibold">${financialSummary.totalValue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Seguro</p>
                <p className="text-xl font-semibold">${financialSummary.insuranceCovered.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Responsabilidad paciente</p>
                <p className="text-xl font-semibold">${financialSummary.patientResponsibility.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagado</p>
                <p className="text-xl font-semibold">${financialSummary.totalPaid.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendiente</p>
                <p className="text-xl font-semibold">${financialSummary.pendingBalance.toFixed(2)}</p>
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
          <CardTitle>Pacientes con este tratamiento</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingAssignments ? (
            <Skeleton className="h-24 w-full" />
          ) : assignments && assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{patientName(assignment.patientId)}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${(assignment.completedSessions / assignment.totalSessions) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {assignment.completedSessions}/{assignment.totalSessions} sesiones
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline">{assignmentStatusLabels[assignment.status]}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      assignment.status === "completado" || advanceSession.isPending
                    }
                    onClick={() =>
                      advanceSession.mutate(assignment.id, {
                        onSuccess: () => toast.success("Sesión registrada"),
                        onError: (err) => toast.error(getErrorMessage(err)),
                      })
                    }
                  >
                    <Plus />
                    Sesión
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ningún paciente tiene este tratamiento asignado todavía.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
