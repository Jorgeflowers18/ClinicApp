import { addDays, format, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"

/** One visible period label; the selected date itself remains owned by the page. */
export function calendarPeriod(date: Date, view: string) {
  if (view === "month") return format(date, "LLLL yyyy", { locale: es })
  if (view === "day") return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = addDays(start, 6)
  const sameYear = start.getFullYear() === end.getFullYear()
  if (sameYear && start.getMonth() === end.getMonth()) return `${format(start, "d")}–${format(end, "d 'de' MMMM 'de' yyyy", { locale: es })}`
  const startFormat = sameYear ? "d 'de' MMMM" : "d 'de' MMMM 'de' yyyy"
  return `${format(start, startFormat, { locale: es })} – ${format(end, "d 'de' MMMM 'de' yyyy", { locale: es })}`
}
