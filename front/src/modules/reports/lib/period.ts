import {
  differenceInCalendarDays,
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
import { ApiError } from "@/shared/types/common"

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

/** Días máximos de un periodo (`ReportPeriod.MaxDays` en el back). */
export const MAX_REPORT_DAYS = 366

export interface PeriodError {
  field: "from" | "to"
  message: string
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/

/**
 * Las mismas reglas y mensajes que el back (`ReportPeriod.TryCreate`): fechas obligatorias, la final igual o
 * posterior a la inicial y como máximo 366 días. `null` si el periodo es válido.
 */
export function periodError(period: ReportPeriod): PeriodError | null {
  if (!isoDate.test(period.from)) return { field: "from", message: "Indica la fecha inicial (AAAA-MM-DD)" }
  if (!isoDate.test(period.to)) return { field: "to", message: "Indica la fecha final (AAAA-MM-DD)" }
  const days = differenceInCalendarDays(parseLocalDate(period.to), parseLocalDate(period.from)) + 1
  if (days < 1) return { field: "to", message: "La fecha final debe ser igual o posterior a la inicial" }
  if (days > MAX_REPORT_DAYS) return { field: "to", message: `El periodo no puede superar ${MAX_REPORT_DAYS} días` }
  return null
}

/** El error del periodo que devolvió el servidor (`400` con `errors.from` o `errors.to`), si lo hubo. */
export function serverPeriodError(error: unknown): PeriodError | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null
  const issue = error.fieldErrors?.find(item => item.field === "from" || item.field === "to")
  return issue ? { field: issue.field as PeriodError["field"], message: issue.message } : null
}

export function formatPeriodLabel(period: ReportPeriod) {
  return `${period.from}_${period.to}`
}
