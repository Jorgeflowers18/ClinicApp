import { Link } from "react-router-dom"
import { Trash2 } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateOnly } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import {
  useActiveTreatments,
  usePatientAssignments,
  useTreatmentsList,
} from "@/modules/treatments/api/treatments.queries"
import { assignmentStatusLabels } from "@/modules/treatments/types/treatment.types"

import type { ClinicalEncounter, ProposedTreatment, RecordFormValues } from "../types/clinical-history.types"
import { PlanItemForm } from "./plan-item-form"

interface TreatmentPlanTabProps {
  patientId: string
  encounters: ClinicalEncounter[]
}

export function TreatmentPlanTab({ patientId, encounters }: TreatmentPlanTabProps) {
  const { control, setValue } = useFormContext<RecordFormValues>()
  const plan = useWatch({ control, name: "plan" })
  const { data: activeTreatments } = useActiveTreatments()
  // Catálogo completo (incluye inactivos) para mostrar nombre y precio de ítems antiguos.
  const { data: catalog } = useTreatmentsList({ page: 1, pageSize: 100 })
  const { data: assignments, isLoading: assignmentsLoading } = usePatientAssignments(patientId)

  const treatmentById = new Map((catalog?.items ?? activeTreatments ?? []).map((treatment) => [treatment.id, treatment]))
  const estimatedTotal = plan.reduce((sum, item) => sum + (treatmentById.get(item.treatmentId ?? "")?.price ?? 0), 0)

  function updatePlan(next: ProposedTreatment[]) {
    setValue("plan", next, { shouldDirty: true })
  }

  // Los ids de las visitas antiguas se conservaron como ids de atención.
  function encounterDate(encounterId: string | undefined) {
    const encounter = encounters.find((item) => item.id === encounterId)
    return encounter ? formatDateOnly(encounter.date, { day: "2-digit", month: "short", year: "numeric" }) : null
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tratamientos propuestos</CardTitle>
          <CardDescription>
            Tratamientos sugeridos al paciente. Se agregan y se quitan con «Guardar cambios»; cuando se realizan, se
            registran en la atención.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PlanItemForm treatments={activeTreatments ?? []} onAdd={(item) => updatePlan([...plan, item])} />

          {plan.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No hay tratamientos propuestos. Agrégalos desde el catálogo.
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pieza / zona</TableHead>
                    <TableHead>Tratamiento</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.map((item) => {
                    const treatment = item.treatmentId ? treatmentById.get(item.treatmentId) : undefined
                    const name = treatment?.name ?? item.description
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.tooth || "General"}</TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="font-medium">{name}</div>
                          {!item.treatmentId && <Badge variant="outline">Texto libre anterior</Badge>}
                        </TableCell>
                        <TableCell className="text-right">{treatment ? formatCurrency(treatment.price) : "—"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Quitar ${name} de los propuestos`}
                            onClick={() => updatePlan(plan.filter((row) => row.id !== item.id))}
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {plan.length > 0 && (
            <p className="text-right text-sm text-muted-foreground">
              Total estimado: <span className="font-medium text-foreground">{formatCurrency(estimatedTotal)}</span>
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
                        {encounterDate(assignment.sourceVisitId)
                          ? `Atención del ${encounterDate(assignment.sourceVisitId)}`
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
