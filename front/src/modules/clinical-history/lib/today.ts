/** Fecha local en formato YYYY-MM-DD (no UTC, para no adelantar el día en América). */
export function today() {
  return toDateOnly(new Date())
}

export function toDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** Suma meses a una fecha YYYY-MM-DD (si el día no existe en el mes destino, toma el último día). */
export function addMonthsToDate(dateOnly: string, months: number) {
  const [year, month, day] = dateOnly.split("-").map(Number)
  const target = new Date(year, month - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, lastDay))
  return toDateOnly(target)
}
