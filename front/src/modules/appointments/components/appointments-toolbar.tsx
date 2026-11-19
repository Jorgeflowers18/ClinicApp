import type { ToolbarProps, View } from "react-big-calendar"
import { createPortal } from "react-dom"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"

import { CalendarDateNavigator } from "./calendar-date-navigator"
import { useAppointmentsCalendar } from "./calendar-presentation-context"
import { calendarPeriod } from "./calendar-period"
import "../calendar-toolbar.css"

export function AppointmentsToolbar<TEvent extends object, TResource extends object>({ date, view, views, localizer, onNavigate, onView }: ToolbarProps<TEvent, TResource>) {
  const { goToToday, toolbarHost, filters } = useAppointmentsCalendar()
  const messages = localizer.messages
  const availableViews = Array.isArray(views) ? views : Object.keys(views) as View[]

  if (!toolbarHost) return null
  return createPortal(
    <div className="rbc-toolbar">
      {filters}
      <div className="rbc-btn-group clinic-calendar-navigation" role="group" aria-label="Navegación temporal">
        <button type="button" onClick={goToToday}><CalendarDays aria-hidden="true" />{messages.today}</button>
        <button type="button" aria-label="Anterior" className="clinic-calendar-arrow" onClick={() => onNavigate("PREV")}><ChevronLeft aria-hidden="true" /><span>{messages.previous}</span></button>
        <button type="button" aria-label="Siguiente" className="clinic-calendar-arrow" onClick={() => onNavigate("NEXT")}><span>{messages.next}</span><ChevronRight aria-hidden="true" /></button>
      </div>
      <div className="rbc-toolbar-label">
        <CalendarDateNavigator date={date} label={calendarPeriod(date, view)} onSelect={(target) => onNavigate("DATE", target)} />
      </div>
      <div className="rbc-btn-group clinic-calendar-views" role="group" aria-label="Vista del calendario">
        {availableViews.map((name) => (
          <button key={name} type="button" aria-pressed={view === name} className={view === name ? "rbc-active" : undefined} onClick={() => onView(name)}>
            {messages[name]}
          </button>
        ))}
      </div>
    </div>, toolbarHost
  )
}
