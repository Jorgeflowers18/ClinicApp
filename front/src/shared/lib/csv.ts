export interface CsvColumn<T> {
  key: keyof T & string
  header: string
}

function escapeCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

/** Genera y descarga un CSV en el navegador. Incluye BOM para que Excel abra los acentos correctamente. */
export function downloadCsv<T extends object>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  if (typeof document === "undefined") return

  const header = columns.map((column) => escapeCell(column.header)).join(",")
  const body = rows.map((row) =>
    columns.map((column) => escapeCell((row as Record<string, unknown>)[column.key])).join(",")
  )
  const content = `﻿${[header, ...body].join("\r\n")}`

  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
