import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Calendar, dateFnsLocalizer, type SlotInfo, type View } from "react-big-calendar"
import { addDays, format, getDay, isSameDay, parse, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Slash } from "lucide-react"
import { toast } from "sonner"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "../appointments-calendar.css"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { PageHeader } from "@/shared/components/page-header"
import { ResponsiveFilterBar } from "@/shared/components/responsive-filter-bar"
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
type MobileAgendaView = "day" | "week"

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
  const [mobileAgendaView, setMobileAgendaView] = useState<MobileAgendaView>("day")
  const [date, setDate] = useState(new Date())
  const [datePickerOpen, setDatePickerOpen] = useState(false)
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
  const dayEvents = events
    .filter((event) => isSameDay(event.start, date))
    .sort((left, right) => left.start.getTime() - right.start.getTime())
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(startOfWeek(date, { weekStartsOn: 1 }), index)
  )

  function renderAgendaEvent(event: CalendarEvent) {
    const isBlock = event.kind === "block"
    const appointment = isBlock ? undefined : event.resource
    return (
      <button
        key={event.id}
        type="button"
        onClick={() => handleSelectEvent(event)}
        className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                {isBlock ? event.resource.reason : patientName(event.resource.patientId)}
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

      <ResponsiveFilterBar
        desktopFilters={
          <div className="min-w-0 space-y-1">
            <Label htmlFor="professionalFilter">Profesional</Label>
            <Select
              value={professionalFilter}
              onValueChange={(value) => setProfessionalFilter(value ?? ALL_PROFESSIONALS)}
            >
              <SelectTrigger id="professionalFilter" className="w-full sm:w-64">
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
        }
        panelTitle="Filtros de citas"
        activeFilterCount={Number(professionalFilter !== ALL_PROFESSIONALS)}
        onClear={() => setProfessionalFilter(ALL_PROFESSIONALS)}
      >
        <div className="space-y-2">
          <Label htmlFor="professionalFilterMobile">Profesional</Label>
          <Select
            value={professionalFilter}
            onValueChange={(value) => setProfessionalFilter(value ?? ALL_PROFESSIONALS)}
          >
            <SelectTrigger id="professionalFilterMobile" className="w-full">
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
      </ResponsiveFilterBar>

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar las citas</AlertTitle>
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <div className="@container min-h-0 min-w-0 flex-1">
          <section className="space-y-4 @xl:hidden" aria-label="Agenda diaria">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label={mobileAgendaView === "day" ? "Día anterior" : "Semana anterior"}
                onClick={() => setDate((current) => addDays(current, mobileAgendaView === "day" ? -1 : -7))}
              >
                <ChevronLeft />
              </Button>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger
                  render={
                    <Button variant="outline" className="min-w-0 flex-1 justify-center gap-2">
                      <CalendarDays />
                      <span className="hidden truncate capitalize @[22rem]:inline">
                        {mobileAgendaView === "day"
                          ? format(date, "EEEE d 'de' MMMM", { locale: es })
                          : `${format(weekDays[0], "d MMM", { locale: es })} – ${format(weekDays[6], "d MMM", { locale: es })}`}
                      </span>
                      <span className="truncate capitalize @[22rem]:hidden">
                        {mobileAgendaView === "day"
                          ? format(date, "d MMM yyyy", { locale: es })
                          : `${format(weekDays[0], "d MMM", { locale: es })} – ${format(weekDays[6], "d MMM", { locale: es })}`}
                      </span>
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0">
                  <DatePickerCalendar
                    mode="single"
                    selected={date}
                    onSelect={(selectedDate) => {
                      if (selectedDate) setDate(selectedDate)
                      setDatePickerOpen(false)
                    }}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="icon"
                aria-label={mobileAgendaView === "day" ? "Día siguiente" : "Semana siguiente"}
                onClick={() => setDate((current) => addDays(current, mobileAgendaView === "day" ? 1 : 7))}
              >
                <ChevronRight />
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setDate(new Date())}>
                Hoy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileAgendaView((current) => current === "day" ? "week" : "day")}
              >
                Ver {mobileAgendaView === "day" ? "semana" : "día"}
              </Button>
            </div>
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
          </section>

          <div className="hidden min-h-[600px] overflow-x-auto rounded-xl border bg-background p-3 @xl:block">
            <div className="min-w-[560px] xl:min-w-0">
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
          </div>
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
