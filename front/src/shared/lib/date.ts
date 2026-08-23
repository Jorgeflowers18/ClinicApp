/**
 * `new Date("1990-04-12")` parsea como medianoche UTC, así que en zonas horarias
 * negativas (América) se muestra un día antes. Estas utilidades parsean fechas
 * "YYYY-MM-DD" como fecha local para fechas puras (nacimiento, vencimientos, etc.).
 */
export function parseLocalDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function formatDateOnly(dateOnly: string, options?: Intl.DateTimeFormatOptions): string {
  return parseLocalDate(dateOnly).toLocaleDateString("es-EC", options)
}

export function formatDateTime(isoString: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(isoString).toLocaleDateString("es-EC", options)
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })
}

export function calculateAge(birthDate: string): number | null {
  const birth = parseLocalDate(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  const diff = Date.now() - birth.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}
