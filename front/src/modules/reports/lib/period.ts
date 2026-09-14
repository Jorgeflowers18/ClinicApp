import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from "date-fns"

import { parseLocalDate } from "@/shared/lib/date"

import type { ReportPeriod, ReportPeriodPreset } from "../types/report.types"

const DATE_ONLY = "yyyy-MM-dd"

/** Semana/mes/año usan el fin de calendario (incluyen citas futuras ya programadas); `last30` es rodante hasta hoy. */
export function getPresetPeriod(preset: Exclude<ReportPeriodPreset, "custom">, now = new Date()): ReportPeriod {
  switch (preset) {
    case "week":
      return {
        from: format(startOfWeek(now, { weekStartsOn: 1 }), DATE_ONLY),
        to: format(endOfWeek(now, { weekStartsOn: 1 }), DATE_ONLY),
      }
    case "month":
      return { from: format(startOfMonth(now), DATE_ONLY), to: format(endOfMonth(now), DATE_ONLY) }
    case "year":
      return { from: format(startOfYear(now), DATE_ONLY), to: format(endOfYear(now), DATE_ONLY) }
    case "last30":
      return { from: format(subDays(now, 29), DATE_ONLY), to: format(now, DATE_ONLY) }
  }
}

export function periodToInterval(period: ReportPeriod) {
  return { start: parseLocalDate(period.from), end: endOfDay(parseLocalDate(period.to)) }
}

/** Para timestamps ISO completos (citas, movimientos, notificaciones...). */
export function isWithinPeriod(isoString: string, period: ReportPeriod) {
  return isWithinInterval(new Date(isoString), periodToInterval(period))
}

/** Para fechas puras YYYY-MM-DD (ej. `startDate` de asignaciones); evita el desfase UTC documentado en `date.ts`. */
export function isDateOnlyWithinPeriod(dateOnly: string, period: ReportPeriod) {
  return isWithinInterval(parseLocalDate(dateOnly), periodToInterval(period))
}

export function formatPeriodLabel(period: ReportPeriod) {
  return `${period.from}_${period.to}`
}
