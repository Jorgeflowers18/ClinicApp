import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateOnly } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import { usePatientAssignments } from "@/modules/treatments/api/treatments.queries"
import { assignmentStatusLabels } from "@/modules/treatments/types/treatment.types"

import { compareEncounters } from "../lib/record"
import type { ClinicalEncounter } from "../types/clinical-history.types"

interface PerformedTreatmentsTabProps {
  patientId: string
  encounters: ClinicalEncounter[]
  professionalName: (encounter: ClinicalEncounter) => string
  onOpenEncounter: (encounterId: string) => void
}

/** Todos los tratamientos realizados al paciente, tomados de sus atenciones. Solo lectura. */
export function PerformedTreatmentsTab({ patientId, encounters, professionalName, onOpenEncounter }: PerformedTreatmentsTabProps) {
  // Solo para mostrar el progreso de asignaciones antiguas con varias sesiones (datos de ejemplo).
  const { data: assignments } = usePatientAssignments(patientId)
  const assignmentById = new Map((assignments ?? []).map((assignment) => [assignment.id, assignment]))
  const rows = [...encounters]
    .sort(compareEncounters)
    .reverse()
    .flatMap((encounter) => encounter.performedTreatments.map((item) => ({ encounter, item })))
  const total = rows.reduce((sum, row) => sum + row.item.cost, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tratamientos realizados</CardTitle>
        <CardDescription>
          Registrados en las atenciones con el precio del catálogo de ese momento. Los pagos se revisan en Finanzas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aún no hay tratamientos realizados. Se registran al guardar una atención.
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tratamiento</TableHead>
                  <TableHead>Pieza / zona</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ encounter, item }) => {
                  const assignment = item.assignmentId ? assignmentById.get(item.assignmentId) : undefined
                  return (
                    <TableRow key={`${encounter.id}-${item.id}`}>
                      <TableCell>{formatDateOnly(encounter.date, { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{item.description}</div>
                        {assignment && assignment.totalSessions > 1 && (
                          <p className="text-xs text-muted-foreground">
                            {assignment.completedSessions}/{assignment.totalSessions} sesiones ·{" "}
                            {assignmentStatusLabels[assignment.status]}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{item.tooth || "General"}</TableCell>
                      <TableCell>{professionalName(encounter)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => onOpenEncounter(encounter.id)}>
                          Ver atención
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
