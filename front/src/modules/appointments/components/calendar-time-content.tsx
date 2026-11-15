import { cloneElement, isValidElement, type HTMLAttributes, type ReactNode } from "react"
import { differenceInMinutes, format, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarDays, LockKeyhole, UserRound } from "lucide-react"
import type { EventProps, HeaderProps } from "react-big-calendar"

import { appointmentStatusLabels } from "../types/appointment.types"
import type { CalendarEvent } from "./calendar-month-content"
import { useAppointmentsCalendar } from "./calendar-presentation-context"

/** The native content button is the single focus target; keep RBC's geometry and handlers. */
export function TimeEventWrapper({ children }: { children?: ReactNode }) {
  return isValidElement<HTMLAttributes<HTMLElement>>(children)
    ? cloneElement(children, { role: undefined, tabIndex: undefined })
    : children
}

export function WeekDateHeader({ date }: HeaderProps) {
  const { date: selected } = useAppointmentsCalendar()
  return (
    <time className="clinic-week-date" dateTime={format(date, "yyyy-MM-dd")} data-selected={isSameDay(date, selected) || undefined} aria-current={isSameDay(date, new Date()) ? "date" : undefined}>
      <span>{format(date, "EEE", { locale: es })}</span>
      <span>{format(date, "d MMM", { locale: es })}</span>
    </time>
  )
}

export function DayDateHeader({ date }: HeaderProps) {
  const label = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
  return (
    <time className="clinic-day-date" dateTime={format(date, "yyyy-MM-dd")} aria-current={isSameDay(date, new Date()) ? "date" : undefined}>
      <CalendarDays aria-hidden="true" />
      {label[0].toLocaleUpperCase("es") + label.slice(1)}
    </time>
  )
}

/** Only event content: RBC retains positioning, overlap, selection and keyboard handlers. */
export function TimeEvent({ event }: EventProps<CalendarEvent>) {
  const { treatmentNames } = useAppointmentsCalendar()
  const duration = differenceInMinutes(event.end, event.start)
  const status = event.kind === "block" ? "Bloqueado" : appointmentStatusLabels[event.resource.status]
  const patient = event.kind === "block" ? event.resource.reason : event.title.endsWith(` · ${status}`) ? event.title.slice(0, -status.length - 3) : event.title
  const treatment = event.kind === "appointment" && event.resource.treatmentId ? treatmentNames.get(event.resource.treatmentId) : undefined
  const Icon = event.kind === "block" ? LockKeyhole : UserRound

  return (
    <button type="button" className="clinic-time-event" data-event-id={event.id} data-compact={duration <= 30 || undefined} data-tiny={duration <= 15 || undefined} aria-label={`${format(event.start, "HH:mm")}–${format(event.end, "HH:mm")} ${event.title}${treatment ? ` · ${treatment}` : ""}`}>
      <time className="clinic-time-event-time" dateTime={event.start.toISOString()}>{format(event.start, "HH:mm")} – {format(event.end, "HH:mm")}</time>
      <span className="clinic-time-event-heading">
        <Icon aria-hidden="true" />
        <strong>{patient}</strong>
        <span className="sr-only"> · {status}</span>
      </span>
      <span className="clinic-time-event-detail">{treatment && <>{treatment}<span aria-hidden="true"> · </span></>}{duration} min</span>
    </button>
  )
}

export function CalendarEventLegend() {
  return (
    <ul className="clinic-calendar-legend" aria-label="Estados de citas y bloqueos">
      <li><span data-state="scheduled" aria-hidden="true" />Programada / Confirmada</li>
      <li><span data-state="completed" aria-hidden="true" />Completada</li>
      <li><span data-state="cancelled" aria-hidden="true" />Cancelada</li>
      <li><span data-state="no-show" aria-hidden="true" />No asistió</li>
      <li><span data-state="block" aria-hidden="true" />Bloqueado</li>
    </ul>
  )
}
