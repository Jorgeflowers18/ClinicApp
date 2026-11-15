import { createContext, useContext } from "react"

interface CalendarPresentation {
  date: Date
  counts: ReadonlyMap<string, number>
  treatmentNames: ReadonlyMap<string, string>
  goToToday: () => void
}

export const CalendarPresentationContext = createContext<CalendarPresentation | null>(null)

export function useAppointmentsCalendar() {
  const context = useContext(CalendarPresentationContext)
  if (!context) throw new Error("Calendar controls must use the appointments presentation provider")
  return context
}
