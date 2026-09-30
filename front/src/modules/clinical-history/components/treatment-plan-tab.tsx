import { Link } from "react-router-dom"
import { Trash2 } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateOnly } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import {
  useActiveTreatments,
  usePatientAssignments,
  useTreatmentsList,
} from "@/modules/treatments/api/treatments.queries"
import { assignmentStatusLabels, type TreatmentAssignment } from "@/modules/treatments/types/treatment.types"

import {
  assignablePlanStatuses,
  planItemStatusLabels,
  planItemStatuses,
  type DentalRecord,
  type PlanItem,
  type VisitFormValues,
} from "../types/clinical-history.types"
import { PlanItemForm } from "./plan-item-form"

const statusItems = Object.fromEntries(planItemStatuses.map((status) => [status, planItemStatusLabels[status]]))

interface TreatmentPlanTabProps {
  patientId: string
  record: DentalRecord
  readOnly: boolean
}

function followUpText(item: PlanItem, assignment: TreatmentAssignment | undefined) {
  if (item.assignmentId) {
    if (!assignment) return "Asignación no disponible"
    return `${assignment.completedSessions}/${assignment.totalSessions} sesiones · ${assignmentStatusLabels[assignment.status]}`
  }
  if (assignablePlanStatuses.includes(item.status)) {
    return item.status === "realizado"
      ? "Se asigna al cerrar la visita y registra la primera sesión"
      : "Se asigna al paciente al cerrar la visita"
  }
  if (item.status === "pendiente") return "Pasa a la próxima visita"
  return "—"
}

export function TreatmentPlanTab({ patientId, record, readOnly }: TreatmentPlanTabProps) {
  const {
    control,
    setValue,
    trigger,
    formState: { errors, isSubmitted },
  } = useFormContext<VisitFormValues>()
  const plan = useWatch({ control, name: "plan" })
  const { data: activeTreatments } = useActiveTreatments()
  // Catálogo completo (incluye inactivos) para mostrar nombre y precio de ítems antiguos.
  const { data: catalog } = useTreatmentsList({ page: 1, pageSize: 100 })
  const { data: assignments, isLoading: assignmentsLoading } = usePatientAssignments(patientId)

  const treatmentById = new Map((catalog?.items ?? activeTreatments ?? []).map((treatment) => [treatment.id, treatment]))
  const assignmentById = new Map((assignments ?? []).map((assignment) => [assignment.id, assignment]))
  const estimatedTotal = plan
    .filter((item) => item.status !== "cancelado" && !item.assignmentId && item.treatmentId)
    .reduce((sum, item) => sum + (treatmentById.get(item.treatmentId ?? "")?.price ?? 0), 0)

  function updatePlan(next: PlanItem[]) {
    setValue("plan", next, { shouldDirty: true })
    if (isSubmitted) void trigger("plan")
  }

  function visitDate(visitId: string | undefined) {
    const visit = record.visits.find((item) => item.id === visitId)
    return visit ? formatDateOnly(visit.date, { day: "2-digit", month: "short", year: "numeric" }) : null
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Plan de tratamiento de esta visita</CardTitle>
          <CardDescription>
            Los tratamientos aprobados o realizados se asignan al paciente al cerrar la visita y aparecen en
            Tratamientos, Finanzas y Reportes. Los propuestos pasan a la siguiente visita.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!readOnly && (
            <PlanItemForm treatments={activeTreatments ?? []} onAdd={(item) => updatePlan([...plan, item])} />
          )}

          {plan.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {readOnly ? "Esta visita no registró tratamientos." : "Agrega tratamientos del catálogo al plan de la visita."}
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pieza / zona</TableHead>
                    <TableHead>Tratamiento</TableHead>
                    <TableHead className="text-right">Sesiones</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Seguimiento</TableHead>
                    {!readOnly && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.map((item, index) => {
                    const editable = !readOnly && !item.assignmentId
                    const treatment = item.treatmentId ? treatmentById.get(item.treatmentId) : undefined
                    const itemErrors = errors.plan?.[index]
                    const message = itemErrors?.treatmentId?.message ?? itemErrors?.sessions?.message
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.tooth || "General"}</TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="font-medium">{treatment?.name ?? item.description}</div>
                          {!item.treatmentId && <Badge variant="outline">Texto libre anterior</Badge>}
                          {message && (
                            <p role="alert" className="text-sm text-destructive">
                              {message}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{item.sessions}</TableCell>
                        <TableCell className="text-right">{treatment ? formatCurrency(treatment.price) : "—"}</TableCell>
                        <TableCell>
                          {editable ? (
                            <Select
                              items={statusItems}
                              value={item.status}
                              onValueChange={(value) =>
                                value &&
                                updatePlan(plan.map((row) => (row.id === item.id ? { ...row, status: value } : row)))
                              }
                            >
                              <SelectTrigger size="sm" aria-label={`Estado de ${item.description}`} aria-invalid={!!itemErrors}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {planItemStatuses.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {planItemStatusLabels[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={item.status === "cancelado" ? "outline" : "secondary"}>
                              {planItemStatusLabels[item.status]}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal text-sm text-muted-foreground">
                          {followUpText(item, item.assignmentId ? assignmentById.get(item.assignmentId) : undefined)}
                        </TableCell>
                        {!readOnly && (
                          <TableCell>
                            {editable && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Quitar ${item.description} del plan`}
                                onClick={() => updatePlan(plan.filter((row) => row.id !== item.id))}
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {plan.length > 0 && (
            <p className="text-right text-sm text-muted-foreground">
              Total estimado de tratamientos por asignar:{" "}
              <span className="font-medium text-foreground">{formatCurrency(estimatedTotal)}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tratamientos asignados al paciente</CardTitle>
          <CardDescription>Progreso real registrado en el módulo de Tratamientos.</CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !assignments?.length ? (
            <p className="text-sm text-muted-foreground">El paciente no tiene tratamientos asignados.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tratamiento</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Origen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <Link className="font-medium hover:underline" to={`/tratamientos/${assignment.treatmentId}`}>
                          {treatmentById.get(assignment.treatmentId)?.name ?? "Tratamiento"}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDateOnly(assignment.startDate)}</TableCell>
                      <TableCell>
                        {assignment.completedSessions}/{assignment.totalSessions} sesiones
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{assignmentStatusLabels[assignment.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {visitDate(assignment.sourceVisitId)
                          ? `Visita del ${visitDate(assignment.sourceVisitId)}`
                          : "Asignado desde Tratamientos"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
