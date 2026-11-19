import { useMemo, type ReactNode } from "react"
import { format, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import type { DateHeaderProps, EventProps } from "react-big-calendar"

import type { Appointment, ScheduleBlock } from "../types/appointment.types"
import { CalendarPresentationContext, useAppointmentsCalendar } from "./calendar-presentation-context"
import { calendarStateClass } from "./calendar-event-presentation"

export type CalendarEvent =
  | { kind: "appointment"; id: string; title: string; start: Date; end: Date; resource: Appointment }
  | { kind: "block"; id: string; title: string; start: Date; end: Date; resource: ScheduleBlock }

/** Presentation derived from the page's date and already filtered events. */
export function CalendarMonthContent({ date, events, treatments, goToToday, toolbarHost, filters, children }: { date: Date; events: CalendarEvent[]; treatments?: ReadonlyArray<{ id: string; name: string }>; goToToday: () => void; toolbarHost: HTMLElement | null; filters: ReactNode; children: ReactNode }) {
  const treatmentNames = useMemo(() => new Map(treatments?.map(({ id, name }) => [id, name])), [treatments])
  const value = useMemo(() => {
    const counts = new Map<string, number>()
    for (const event of events) {
      if (event.kind !== "appointment") continue
      const key = format(event.start, "yyyy-MM-dd")
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return { date, counts, treatmentNames, goToToday, toolbarHost, filters }
  }, [date, events, treatmentNames, goToToday, toolbarHost, filters])

  return <CalendarPresentationContext.Provider value={value}>{children}</CalendarPresentationContext.Provider>
}

export function MonthDateHeader({ date, label, onDrillDown }: DateHeaderProps) {
  const content = useAppointmentsCalendar()
  const key = format(date, "yyyy-MM-dd")
  const count = content.counts.get(key) ?? 0
  const selected = isSameDay(date, content.date)
  const today = isSameDay(date, new Date())
  const dateLabel = format(date, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })

  return (
    <div className="clinic-month-date" data-date={key} data-selected={selected || undefined}>
      <button
        type="button"
        className="rbc-button-link clinic-month-day-number"
        aria-label={`${dateLabel}${selected ? ", fecha seleccionada" : ""}`}
        aria-current={today ? "date" : undefined}
        onClick={onDrillDown}
      >
        <time dateTime={key}>{label}</time>
      </button>
      {count > 0 && (
        <span className="clinic-month-count" aria-label={`${count} ${count === 1 ? "cita" : "citas"}`} title={`${count} ${count === 1 ? "cita" : "citas"}`}>
          {count}
        </span>
      )}
    </div>
  )
}

export function MonthEvent({ event, title }: EventProps<CalendarEvent>) {
  const time = `${format(event.start, "HH:mm")}–${format(event.end, "HH:mm")}`
  return (
    <button type="button" className={`clinic-month-event ${calendarStateClass(event.kind === "block" ? "block" : event.resource.status)}`} data-event-id={event.id} aria-label={`${time} ${title}`} title={`${time} ${title}`}>
      <time dateTime={event.start.toISOString()}>{format(event.start, "HH:mm")}</time>
      <span>{title}</span>
    </button>
  )
}
