import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Calendar, dateFnsLocalizer, type SlotInfo, type View } from "react-big-calendar"
import { format, getDay, parse, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, Slash } from "lucide-react"
import { toast } from "sonner"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "../appointments-calendar.css"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { PageHeader } from "@/shared/components/page-header"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatientsList } from "@/modules/patients/api/patients.queries"
import { useActiveTreatments } from "@/modules/treatments/api/treatments.queries"

import {
  useAppointmentsList,
  useDeleteScheduleBlock,
  useProfessionals,
  useRooms,
  useScheduleBlocksList,
} from "../api/appointments.queries"
import { AppointmentDetailDialog } from "../components/appointment-detail-dialog"
import { AppointmentFormDialog } from "../components/appointment-form-dialog"
import { ScheduleBlockFormDialog } from "../components/schedule-block-form-dialog"
import { appointmentStatusLabels, type Appointment, type ScheduleBlock } from "../types/appointment.types"

const locales = { es }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

const ALL_PROFESSIONALS = "all"

type CalendarEvent =
  | { kind: "appointment"; id: string; title: string; start: Date; end: Date; resource: Appointment }
  | { kind: "block"; id: string; title: string; start: Date; end: Date; resource: ScheduleBlock }

export function AppointmentsCalendarPage() {
  const [searchParams] = useSearchParams()
  const patientFilter = searchParams.get("pacienteId")
  const [professionalFilter, setProfessionalFilter] = useState<string>(ALL_PROFESSIONALS)

  const { data: appointments, isLoading, isError, error } = useAppointmentsList()
  const { data: scheduleBlocks } = useScheduleBlocksList()
  const { data: professionals } = useProfessionals()
  const { data: rooms } = useRooms()
  const { data: patientsPage } = usePatientsList({ page: 1, pageSize: 100 })
  const { data: treatments } = useActiveTreatments()
  const deleteScheduleBlock = useDeleteScheduleBlock()

  const [view, setView] = useState<View>("week")
  const [date, setDate] = useState(new Date())
  const [formOpen, setFormOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>(undefined)
  const [blockFormOpen, setBlockFormOpen] = useState(false)
  const [initialSlot, setInitialSlot] = useState<{ date: string; startTime: string; endTime: string } | undefined>()
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [blockToDelete, setBlockToDelete] = useState<ScheduleBlock | null>(null)

  function patientName(patientId: string) {
    const patient = patientsPage?.items.find((item) => item.id === patientId)
    return patient ? `${patient.firstName} ${patient.lastName}` : "Paciente"
  }

  function professionalName(professionalId: string) {
    return professionals?.find((item) => item.id === professionalId)?.name ?? "Profesional"
  }

  function treatmentName(treatmentId?: string) {
    if (!treatmentId) return undefined
    return treatments?.find((item) => item.id === treatmentId)?.name
  }

  function roomName(roomId?: string) {
    if (!roomId) return undefined
    return rooms?.find((item) => item.id === roomId)?.name
  }

  const events = useMemo<CalendarEvent[]>(() => {
    const matchesProfessional = (professionalId?: string) =>
      professionalFilter === ALL_PROFESSIONALS || professionalId === professionalFilter

    const appointmentEvents: CalendarEvent[] = (appointments ?? [])
      .filter((appointment) => !patientFilter || appointment.patientId === patientFilter)
      .filter((appointment) => matchesProfessional(appointment.professionalId))
      .map((appointment) => ({
        kind: "appointment",
        id: appointment.id,
        title: `${patientName(appointment.patientId)} · ${appointmentStatusLabels[appointment.status]}`,
        start: new Date(appointment.start),
        end: new Date(appointment.end),
        resource: appointment,
      }))

    const blockEvents: CalendarEvent[] = (scheduleBlocks ?? [])
      .filter((block) => matchesProfessional(block.professionalId))
      .map((block) => ({
        kind: "block",
        id: block.id,
        title: `Bloqueado · ${block.reason}`,
        start: new Date(block.start),
        end: new Date(block.end),
        resource: block,
      }))

    return [...appointmentEvents, ...blockEvents]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, scheduleBlocks, patientFilter, professionalFilter, patientsPage])

  function handleSelectSlot(slotInfo: SlotInfo) {
    setEditingAppointment(undefined)
    setInitialSlot({
      date: toDateInputValue(slotInfo.start),
      startTime: toTimeInputValue(slotInfo.start),
      endTime: toTimeInputValue(slotInfo.end),
    })
    setFormOpen(true)
  }

  function handleSelectEvent(event: CalendarEvent) {
    if (event.kind === "block") {
      setBlockToDelete(event.resource)
    } else {
      setSelectedAppointment(event.resource)
    }
  }

  function handleDeleteBlock() {
    if (!blockToDelete) return
    deleteScheduleBlock.mutate(blockToDelete.id, {
      onSuccess: () => {
        toast.success("Bloqueo eliminado")
        setBlockToDelete(null)
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <PageHeader
        title="Citas"
        description="Calendario de citas de la clínica."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setInitialSlot(undefined)
                setBlockFormOpen(true)
              }}
            >
              <Slash />
              Bloquear horario
            </Button>
            <Button
              onClick={() => {
                setEditingAppointment(undefined)
                setInitialSlot(undefined)
                setFormOpen(true)
              }}
            >
              <Plus />
              Nueva cita
            </Button>
          </>
        }
      />

      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="professionalFilter">Profesional</Label>
          <Select
            value={professionalFilter}
            onValueChange={(value) => setProfessionalFilter(value ?? ALL_PROFESSIONALS)}
          >
            <SelectTrigger id="professionalFilter" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROFESSIONALS}>Todos los profesionales</SelectItem>
              {professionals?.map((professional) => (
                <SelectItem key={professional.id} value={professional.id}>
                  {professional.name} · {professional.specialty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar las citas</AlertTitle>
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <div className="min-h-[600px] flex-1 rounded-xl border bg-background p-3">
          <Calendar
            localizer={localizer}
            culture="es"
            events={events}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            views={["month", "week", "day"]}
            selectable
            popup
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            style={{ height: 600 }}
            eventPropGetter={(event: CalendarEvent) => {
              if (event.kind === "block") {
                return { className: "rbc-event-block" }
              }
              const status = event.resource.status
              return {
                className:
                  status === "cancelada"
                    ? "rbc-event-cancelled"
                    : status === "completada"
                      ? "rbc-event-completed"
                      : status === "no_asistio"
                        ? "rbc-event-no-show"
                        : undefined,
              }
            }}
            messages={{
              next: "Sig.",
              previous: "Ant.",
              today: "Hoy",
              month: "Mes",
              week: "Semana",
              day: "Día",
              agenda: "Agenda",
              noEventsInRange: "No hay citas en este rango.",
            }}
          />
        </div>
      )}

      <AppointmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        appointment={editingAppointment}
        initialSlot={initialSlot}
      />

      <ScheduleBlockFormDialog open={blockFormOpen} onOpenChange={setBlockFormOpen} initialSlot={initialSlot} />

      <AppointmentDetailDialog
        open={!!selectedAppointment}
        onOpenChange={(open) => !open && setSelectedAppointment(null)}
        appointment={selectedAppointment}
        patientName={selectedAppointment ? patientName(selectedAppointment.patientId) : ""}
        professionalName={selectedAppointment ? professionalName(selectedAppointment.professionalId) : ""}
        treatmentName={selectedAppointment ? treatmentName(selectedAppointment.treatmentId) : undefined}
        roomName={selectedAppointment ? roomName(selectedAppointment.roomId) : undefined}
        onEdit={() => {
          if (!selectedAppointment) return
          setEditingAppointment(selectedAppointment)
          setSelectedAppointment(null)
          setFormOpen(true)
        }}
      />

      <ConfirmDialog
        open={!!blockToDelete}
        onOpenChange={(open) => !open && setBlockToDelete(null)}
        title="Eliminar bloqueo de horario"
        description={`¿Confirmas que deseas eliminar el bloqueo "${blockToDelete?.reason}"? El horario quedará disponible nuevamente.`}
        confirmLabel="Eliminar"
        destructive
        isLoading={deleteScheduleBlock.isPending}
        onConfirm={handleDeleteBlock}
      />
    </div>
  )
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toTimeInputValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}
