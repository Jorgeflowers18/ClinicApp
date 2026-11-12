import type { ToolbarProps, View } from "react-big-calendar"
import { addDays, startOfWeek } from "date-fns"

import { CalendarDateNavigator } from "./calendar-date-navigator"

export function AppointmentsToolbar<TEvent extends object, TResource extends object>({ date, label, view, views, localizer, onNavigate, onView }: ToolbarProps<TEvent, TResource>) {
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
        <button type="button" onClick={() => onNavigate("TODAY")}>{messages.today}</button>
        <button type="button" onClick={() => onNavigate("PREV")}>{messages.previous}</button>
        <button type="button" onClick={() => onNavigate("NEXT")}>{messages.next}</button>
      </div>
      <div className="rbc-toolbar-label">
        <CalendarDateNavigator date={date} label={periodLabel} onSelect={(target) => onNavigate("DATE", target)} />
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
