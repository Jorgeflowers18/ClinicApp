import { format } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime, formatTime } from "@/shared/lib/date"
import {
  useAppointmentsByPatient,
  useProfessionals,
  useRooms,
} from "@/modules/appointments/api/appointments.queries"
import { appointmentStatusLabels, appointmentStatusVariants } from "@/modules/appointments/types/appointment.types"

import { linkableAppointmentStatuses } from "../hooks/use-patient-appointment-options"
import { today } from "../lib/record"
import type { ClinicalEncounter } from "../types/clinical-history.types"

interface PatientAppointmentsTabProps {
  patientId: string
  encounters: ClinicalEncounter[]
  treatmentName: (treatmentId: string) => string | undefined
  /** «Registrar atención» se habilita cuando el odontograma terminó de cargar. */
  canRegister: boolean
  onRegisterEncounter: (appointmentId: string) => void
  onOpenEncounter: (encounterId: string) => void
}

/** Citas del paciente con su estado y observaciones. Solo lectura: las citas se editan desde la Agenda. */
export function PatientAppointmentsTab({
  patientId,
  encounters,
  treatmentName,
  canRegister,
  onRegisterEncounter,
  onOpenEncounter,
}: PatientAppointmentsTabProps) {
  const { data: appointments, isLoading } = useAppointmentsByPatient(patientId)
  const { data: professionals } = useProfessionals()
  const { data: rooms } = useRooms()
  const encounterByAppointment = new Map(
    encounters.filter((encounter) => encounter.appointmentId).map((encounter) => [encounter.appointmentId, encounter])
  )
  const todayValue = today()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Citas del paciente</CardTitle>
        <CardDescription>
          De la más reciente a la más antigua. Las citas se crean y se modifican desde la Agenda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !appointments?.length ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            El paciente no tiene citas registradas.
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table aria-label="Citas del paciente">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Tratamiento</TableHead>
                  <TableHead>Consultorio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => {
                  const encounter = encounterByAppointment.get(appointment.id)
                  const professional = professionals?.find((item) => item.id === appointment.professionalId)
                  const room = rooms?.find((item) => item.id === appointment.roomId)
                  // Igual que en «Registrar atención»: una atención no puede tener fecha futura.
                  const isFuture = format(new Date(appointment.start), "yyyy-MM-dd") > todayValue
                  const canLink = linkableAppointmentStatuses.includes(appointment.status)
                  return (
                    <TableRow key={appointment.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(appointment.start, { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                        {formatTime(appointment.start)}
                      </TableCell>
                      <TableCell>{professional?.name ?? "—"}</TableCell>
                      <TableCell>{(appointment.treatmentId && treatmentName(appointment.treatmentId)) || "—"}</TableCell>
                      <TableCell>{room?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={appointmentStatusVariants[appointment.status]}>
                          {appointmentStatusLabels[appointment.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                        {appointment.notes?.trim() || "Sin observaciones"}
                      </TableCell>
                      <TableCell className="text-right">
                        {encounter ? (
                          <Button size="sm" variant="ghost" onClick={() => onOpenEncounter(encounter.id)}>
                            Ver atención
                          </Button>
                        ) : canLink && !isFuture ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canRegister}
                            onClick={() => onRegisterEncounter(appointment.id)}
                          >
                            Registrar atención
                          </Button>
                        ) : canLink ? (
                          <span className="text-xs text-muted-foreground">Próxima cita</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
