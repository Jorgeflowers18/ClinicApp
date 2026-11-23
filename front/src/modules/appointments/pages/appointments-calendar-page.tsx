import { useCallback, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Calendar, dateFnsLocalizer, type SlotInfo, type View } from "react-big-calendar"
import { addDays, endOfMonth, endOfWeek, format, getDay, isSameDay, parse, startOfDay, startOfMonth, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, Slash } from "lucide-react"
import { toast } from "sonner"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "../appointments-calendar.css"
import "../calendar-event-colors.css"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { AppointmentsToolbar } from "../components/appointments-toolbar"
import { CalendarProfessionalFilters, ALL_CALENDAR_PROFESSIONALS, ALL_CALENDAR_SPECIALTIES } from "../components/calendar-professional-filters"
import { calendarEventClass, calendarStateClass } from "../components/calendar-event-presentation"
import { CalendarMonthContent, MonthDateHeader, MonthEvent, type CalendarEvent } from "../components/calendar-month-content"
import { CalendarEventLegend, DayDateHeader, TimeEvent, TimeEventWrapper, WeekDateHeader } from "../components/calendar-time-content"
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

const ALL_PROFESSIONALS = ALL_CALENDAR_PROFESSIONALS

/** Los días que muestra el calendario: el mes con sus semanas completas, la semana (de lunes) o el día. */
function visibleRange(date: Date, view: View) {
  const day = (value: Date) => format(value, "yyyy-MM-dd")
  if (view === "month") return { from: day(startOfWeek(startOfMonth(date), { weekStartsOn: 1 })), to: day(endOfWeek(endOfMonth(date), { weekStartsOn: 1 })) }
  if (view === "day") return { from: day(date), to: day(date) }
  return { from: day(startOfWeek(date, { weekStartsOn: 1 })), to: day(endOfWeek(date, { weekStartsOn: 1 })) }
}
const calendarComponents = {
  toolbar: AppointmentsToolbar,
  month: { dateHeader: MonthDateHeader, event: MonthEvent },
  week: { header: WeekDateHeader, event: TimeEvent, eventWrapper: TimeEventWrapper },
  day: { header: DayDateHeader, event: TimeEvent, eventWrapper: TimeEventWrapper },
}

export function AppointmentsCalendarPage() {
  const [searchParams] = useSearchParams()
  const patientFilter = searchParams.get("pacienteId")
  const [professionalFilter, setProfessionalFilter] = useState<string>(ALL_PROFESSIONALS)
  const [specialtyFilter, setSpecialtyFilter] = useState<string>(ALL_CALENDAR_SPECIALTIES)
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null)

  const [view, setView] = useState<View>("week")
  // Compact layouts render the selected calendar view, so resizing keeps the
  // user's choice. Event, date, selection and form handlers remain shared.
  const mobileAgendaView = view === "day" ? "day" : "week"
  const [date, setDate] = useState(new Date())
  const goToToday = useCallback(() => setDate(startOfDay(new Date())), [])
  // Solo se piden las citas y los bloqueos de los días visibles.
  const range = useMemo(() => visibleRange(date, view), [date, view])
  const { data: appointments, isLoading, isError, error } = useAppointmentsList(range)
  const { data: scheduleBlocks } = useScheduleBlocksList(range)
  const { data: professionals } = useProfessionals()
  const { data: rooms } = useRooms()
  const { data: patientsPage, isLoading: patientsLoading } = usePatientsList({ page: 1, pageSize: 100 })
  const { data: treatments } = useActiveTreatments()
  const deleteScheduleBlock = useDeleteScheduleBlock()
  const [formOpen, setFormOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>(undefined)
  const [blockFormOpen, setBlockFormOpen] = useState(false)
  const [initialSlot, setInitialSlot] = useState<{ date: string; startTime: string; endTime: string } | undefined>()
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [blockToDelete, setBlockToDelete] = useState<ScheduleBlock | null>(null)

  function patientName(patientId: string, known?: string) {
    // La API trae el nombre en la cita; la lista de pacientes es solo un respaldo.
    if (known) return known
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
      (professionalFilter === ALL_PROFESSIONALS || professionalId === professionalFilter)
      && (specialtyFilter === ALL_CALENDAR_SPECIALTIES || !professionalId || professionals?.some(item => item.id === professionalId && item.specialty?.trim() === specialtyFilter))

    const appointmentEvents: CalendarEvent[] = (appointments ?? [])
      .filter((appointment) => !patientFilter || appointment.patientId === patientFilter)
      .filter((appointment) => matchesProfessional(appointment.professionalId))
      .map((appointment) => ({
        kind: "appointment",
        id: appointment.id,
        title: `${patientName(appointment.patientId, appointment.patientName)} · ${appointmentStatusLabels[appointment.status]}`,
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
  }, [appointments, scheduleBlocks, patientFilter, professionalFilter, patientsPage, professionals, specialtyFilter])
  const dayEvents = events
    .filter((event) => isSameDay(event.start, date))
    .sort((left, right) => left.start.getTime() - right.start.getTime())
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(startOfWeek(date, { weekStartsOn: 1 }), index)
  )
  const scrollToTime = useMemo(() => {
    const visibleDays = view === "day" ? [date] : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date, { weekStartsOn: 1 }), index))
    const hours = events.filter((event) => visibleDays.some((day) => isSameDay(day, event.start))).map((event) => event.start.getHours())
    const hour = hours.length ? Math.max(0, Math.min(...hours) - 1) : new Date().getHours()
    const target = new Date(date)
    target.setHours(hour, 0, 0, 0)
    return target
  }, [events, date, view])

  function renderAgendaEvent(event: CalendarEvent) {
    const isBlock = event.kind === "block"
    const appointment = isBlock ? undefined : event.resource
    return (
      <button
        key={event.id}
        type="button"
        onClick={() => handleSelectEvent(event)}
        data-calendar-event-state={isBlock ? "block" : event.resource.status}
        data-event-id={event.id}
        className={`clinic-agenda-event ${calendarStateClass(isBlock ? "block" : event.resource.status)} block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      >
        <Card className="transition-colors hover:bg-muted/30">
          <CardContent className="flex min-w-0 items-start gap-3 py-4">
            <div className="w-16 shrink-0 text-sm font-semibold tabular-nums">
              {format(event.start, "HH:mm")}
              <span className="block text-xs font-normal text-muted-foreground">
                {format(event.end, "HH:mm")}
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="break-words font-medium">
                {isBlock ? event.resource.reason : patientName(event.resource.patientId, event.resource.patientName)}
              </p>
              <p className="break-words text-sm text-muted-foreground">
                {isBlock
                  ? event.resource.professionalId
                    ? professionalName(event.resource.professionalId)
                    : event.resource.roomId
                      ? roomName(event.resource.roomId)
                      : "Bloqueo de horario"
                  : `${professionalName(event.resource.professionalId)}${treatmentName(event.resource.treatmentId) ? ` · ${treatmentName(event.resource.treatmentId)}` : ""}`}
              </p>
            </div>
            <Badge
              variant={
                isBlock
                  ? "secondary"
                  : appointment?.status === "cancelada" || appointment?.status === "no_asistio"
                    ? "destructive"
                    : appointment?.status === "completada"
                      ? "outline"
                      : "default"
              }
              className="shrink-0"
            >
              {isBlock ? "Bloqueado" : appointmentStatusLabels[event.resource.status]}
            </Badge>
          </CardContent>
        </Card>
      </button>
    )
  }

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
    <div className="clinic-appointments-page">
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

      <div className="clinic-calendar-workspace">
      {isError && (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar las citas</AlertTitle>
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {isLoading || patientsLoading ? (
        <Skeleton className="min-h-0 w-full flex-1" />
      ) : (
        <CalendarMonthContent date={date} events={events} treatments={treatments} goToToday={goToToday} toolbarHost={toolbarHost}
          filters={<CalendarProfessionalFilters professionals={professionals ?? []} professional={professionalFilter} specialty={specialtyFilter}
            onProfessionalChange={setProfessionalFilter} onSpecialtyChange={setSpecialtyFilter}
            onClear={() => { setProfessionalFilter(ALL_PROFESSIONALS); setSpecialtyFilter(ALL_CALENDAR_SPECIALTIES) }} />}>
        <div className="clinic-appointments-calendar @container min-h-0 min-w-0 flex-1">
          <div className="clinic-calendar-toolbar-host" ref={setToolbarHost} />
          {view !== "month" && <section className="clinic-compact-calendar flex @xl:hidden" aria-label={mobileAgendaView === "day" ? "Agenda diaria" : "Agenda semanal"}>
            <div className="clinic-compact-agenda">
            {mobileAgendaView === "day" && dayEvents.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No hay citas ni bloqueos para este día.
                </CardContent>
              </Card>
            ) : mobileAgendaView === "day" ? (
              <div className="space-y-3">
                {dayEvents.map(renderAgendaEvent)}
              </div>
            ) : (
              <div className="space-y-5">
                {weekDays.map((weekDay) => {
                  const dateEvents = events
                    .filter((event) => isSameDay(event.start, weekDay))
                    .sort((left, right) => left.start.getTime() - right.start.getTime())
                  return (
                    <section key={weekDay.toISOString()} className="space-y-2">
                      <h2 className="text-sm font-semibold capitalize">
                        {format(weekDay, "EEEE d 'de' MMMM", { locale: es })}
                      </h2>
                      {dateEvents.length > 0 ? (
                        <div className="space-y-2">{dateEvents.map(renderAgendaEvent)}</div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin citas</p>
                      )}
                    </section>
                  )
                })}
              </div>
            )}
            </div>
          </section>}

          <div
            className={`clinic-calendar-frame ${view === "month" ? "block" : "hidden"} max-w-full overflow-x-auto @xl:block`}
            data-calendar-view={view}
            role="region"
            aria-label="Calendario de citas, desplazable horizontalmente"
            tabIndex={0}
          >
            <div className="clinic-calendar-native min-w-[560px] xl:min-w-0">
              <Calendar
            localizer={localizer}
            culture="es"
            components={calendarComponents}
            events={events}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            scrollToTime={scrollToTime}
            views={["month", "week", "day"]}
            selectable
            popup
            dayPropGetter={(day) => isSameDay(day, date) ? { className: "clinic-calendar-selected-day" } : {}}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={(event: CalendarEvent) => ({ className: calendarEventClass(event.kind === "block" ? "block" : event.resource.status) })}
            messages={{
              next: "Sig.",
              previous: "Ant.",
              today: "Hoy",
              month: "Mes",
              week: "Semana",
              day: "Día",
              agenda: "Agenda",
              showMore: (count) => `+${count} más`,
              noEventsInRange: "No hay citas en este rango.",
            }}
            />
            </div>
          </div>
          <CalendarEventLegend />
        </div>
        </CalendarMonthContent>
      )}
      </div>

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
        patientName={selectedAppointment ? patientName(selectedAppointment.patientId, selectedAppointment.patientName) : ""}
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
