import { CalendarDays, CalendarX2, CircleCheck, BadgeCheck, LockKeyhole, UserRoundX } from "lucide-react"
import type { AppointmentStatus } from "../types/appointment.types"

export type CalendarVisualState = AppointmentStatus | "block"

export function calendarStateClass(state: CalendarVisualState) {
  return `clinic-calendar-state-${state}`
}

export const calendarStateIcons = {
  programada: CalendarDays,
  confirmada: CircleCheck,
  completada: BadgeCheck,
  cancelada: CalendarX2,
  no_asistio: UserRoundX,
  block: LockKeyhole,
} satisfies Record<CalendarVisualState, typeof CalendarDays>

/** Existing RBC classes retain cancellation, no-show and block interaction styling. */
export function calendarEventClass(state: CalendarVisualState) {
  const legacy = { completada: "rbc-event-completed", cancelada: "rbc-event-cancelled", no_asistio: "rbc-event-no-show", block: "rbc-event-block" }
  return `${calendarStateClass(state)} ${state in legacy ? legacy[state as keyof typeof legacy] : ""}`
}
