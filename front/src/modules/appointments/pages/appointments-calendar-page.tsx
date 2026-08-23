import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Calendar, dateFnsLocalizer, type SlotInfo, type View } from "react-big-calendar"
import { format, getDay, parse, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"
import { Plus } from "lucide-react"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "../appointments-calendar.css"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/shared/components/page-header"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatientsList } from "@/modules/patients/api/patients.queries"
import { useActiveTreatments } from "@/modules/treatments/api/treatments.queries"

import { useAppointmentsList, useProfessionals } from "../api/appointments.queries"
import { AppointmentDetailDialog } from "../components/appointment-detail-dialog"
import { AppointmentFormDialog } from "../components/appointment-form-dialog"
import { appointmentStatusLabels, type Appointment } from "../types/appointment.types"

const locales = { es }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: Appointment
}

export function AppointmentsCalendarPage() {
  const [searchParams] = useSearchParams()
  const patientFilter = searchParams.get("pacienteId")

  const { data: appointments, isLoading, isError, error } = useAppointmentsList()
  const { data: professionals } = useProfessionals()
  const { data: patientsPage } = usePatientsList({ page: 1, pageSize: 100 })
  const { data: treatments } = useActiveTreatments()

  const [view, setView] = useState<View>("week")
  const [date, setDate] = useState(new Date())
  const [formOpen, setFormOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>(undefined)
  const [initialSlot, setInitialSlot] = useState<{ date: string; startTime: string; endTime: string } | undefined>()
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

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

  const events = useMemo<CalendarEvent[]>(() => {
    const source = patientFilter
      ? appointments?.filter((appointment) => appointment.patientId === patientFilter)
      : appointments

    return (source ?? []).map((appointment) => ({
      id: appointment.id,
      title: `${patientName(appointment.patientId)} · ${appointmentStatusLabels[appointment.status]}`,
      start: new Date(appointment.start),
      end: new Date(appointment.end),
      resource: appointment,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, patientFilter, patientsPage])

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
    setSelectedAppointment(event.resource)
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <PageHeader
        title="Citas"
        description="Calendario de citas de la clínica."
        actions={
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
        }
      />

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
            eventPropGetter={(event: CalendarEvent) => ({
              className:
                event.resource.status === "cancelada"
                  ? "rbc-event-cancelled"
                  : event.resource.status === "completada"
                    ? "rbc-event-completed"
                    : undefined,
            })}
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

      <AppointmentDetailDialog
        open={!!selectedAppointment}
        onOpenChange={(open) => !open && setSelectedAppointment(null)}
        appointment={selectedAppointment}
        patientName={selectedAppointment ? patientName(selectedAppointment.patientId) : ""}
        professionalName={selectedAppointment ? professionalName(selectedAppointment.professionalId) : ""}
        treatmentName={selectedAppointment ? treatmentName(selectedAppointment.treatmentId) : undefined}
        onEdit={() => {
          if (!selectedAppointment) return
          setEditingAppointment(selectedAppointment)
          setSelectedAppointment(null)
          setFormOpen(true)
        }}
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
