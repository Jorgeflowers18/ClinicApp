import type { ToolbarProps, View } from "react-big-calendar"
import { addDays, startOfWeek } from "date-fns"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"

import { CalendarDateNavigator } from "./calendar-date-navigator"
import { useAppointmentsCalendar } from "./calendar-presentation-context"

export function AppointmentsToolbar<TEvent extends object, TResource extends object>({ date, label, view, views, localizer, onNavigate, onView }: ToolbarProps<TEvent, TResource>) {
  const { goToToday } = useAppointmentsCalendar()
  const messages = localizer.messages
  const availableViews = Array.isArray(views) ? views : Object.keys(views) as View[]
  const year = String(date.getFullYear())
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)
  const years = view === "week" && weekStart.getFullYear() !== weekEnd.getFullYear()
    ? `${weekStart.getFullYear()}–${weekEnd.getFullYear()}`
    : year
  const periodLabel = label.includes(years) ? label : `${label} · ${years}`

  return (
    <div className="rbc-toolbar">
      <div className="rbc-btn-group" role="group" aria-label="Navegación temporal">
        <button type="button" onClick={goToToday}><CalendarDays aria-hidden="true" />{messages.today}</button>
        <button type="button" onClick={() => onNavigate("PREV")}><ChevronLeft aria-hidden="true" />{messages.previous}</button>
        <button type="button" onClick={() => onNavigate("NEXT")}>{messages.next}<ChevronRight aria-hidden="true" /></button>
      </div>
      <div className="rbc-toolbar-label">
        <CalendarDateNavigator date={date} onSelect={(target) => onNavigate("DATE", target)} />
        <p className="clinic-calendar-period" aria-label="Periodo visible">{periodLabel}</p>
      </div>
      <div className="rbc-btn-group" role="group" aria-label="Vista del calendario">
        {availableViews.map((name) => (
          <button key={name} type="button" aria-pressed={view === name} className={view === name ? "rbc-active" : undefined} onClick={() => onView(name)}>
            {messages[name]}
          </button>
        ))}
      </div>
    </div>
  )
}
