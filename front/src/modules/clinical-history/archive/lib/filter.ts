import type { DentalAttachment } from "../../types/clinical-history.types"
import type { ArchiveCatalog } from "../types"
import { archiveText, fileClinicalType, fileName, fileTypeLabel, formatLabel } from "./classification"

export interface ArchiveFilters { search: string; type: string; category: string; date: string; from: string; to: string; professional: string; tag: string; treatment: string; status: string; order: string; group: string }
export const emptyFilters = (): ArchiveFilters => ({ search: "", type: "all", category: "all", date: "all", from: "", to: "", professional: "all", tag: "all", treatment: "all", status: "active", order: "recent", group: "none" })
export const datePresets = { all: "Todas las fechas", today: "Hoy", week: "Esta semana", month: "Este mes", days30: "Últimos 30 días", months3: "Últimos 3 meses", year: "Este año", custom: "Rango personalizado" }
export function dateBounds(filters: ArchiveFilters, now = new Date()): [string, string] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()), end = new Date(start)
  const ymd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  switch (filters.date) {
    case "all": return ["", ""]
    case "custom": return [filters.from, filters.to]
    case "week": start.setDate(start.getDate() - (start.getDay() + 6) % 7); end.setTime(start.getTime()); end.setDate(end.getDate() + 6); break
    case "month": start.setDate(1); end.setMonth(end.getMonth() + 1, 0); break
    case "days30": start.setDate(start.getDate() - 29); break
    case "months3": start.setMonth(start.getMonth() - 3); break
    case "year": start.setMonth(0, 1); end.setMonth(11, 31); break
  }
  return [ymd(start), ymd(end)]
}
export function selectClinicalFiles(files: DentalAttachment[], filters: ArchiveFilters, catalog: ArchiveCatalog, professionals: Record<string, string>, now?: Date) {
  const [from, to] = dateBounds(filters, now)
  const search = archiveText(filters.search)
  const selected = files.filter((file) => {
    const meta = file.archive
    if (filters.status !== "all" && Boolean(meta?.archivedAt) !== (filters.status === "archived")) return false
    if (filters.type !== "all" && fileClinicalType(file) !== filters.type) return false
    if (filters.category !== "all" && (meta?.categoryId ?? "none") !== filters.category) return false
    if (filters.professional !== "all" && meta?.professionalId !== filters.professional) return false
    if (filters.tag !== "all" && !meta?.tagIds.includes(filters.tag)) return false
    if (filters.treatment !== "all" && meta?.treatmentId !== filters.treatment) return false
    if ((from || to) && (!meta?.studyDate || from && meta.studyDate < from || to && meta.studyDate > to)) return false
    const terms = [fileName(file), file.name, fileTypeLabel(file), formatLabel(file), catalog.categories.find((item) => item.id === meta?.categoryId)?.name, ...catalog.tags.filter((item) => meta?.tagIds.includes(item.id)).map((item) => item.name), professionals[meta?.professionalId ?? ""], meta?.zone, meta?.notes].join(" ")
    return !search || archiveText(terms).includes(search)
  })
  return selected.sort((a, b) => filters.order === "az" ? fileName(a).localeCompare(fileName(b), "es") : filters.order === "za" ? fileName(b).localeCompare(fileName(a), "es") : (filters.order === "oldest" ? 1 : -1) * ((a.archive?.studyDate || a.createdAt).localeCompare(b.archive?.studyDate || b.createdAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)))
}
export function mergeArchiveRows<T extends { id: string }>(baseline: T[], draft: T[], confirmed: T[]): T[] {
  const same = (a: T | undefined, b: T | undefined) => JSON.stringify(a) === JSON.stringify(b)
  const result = confirmed.flatMap((item) => {
    const base = baseline.find((row) => row.id === item.id), local = draft.find((row) => row.id === item.id)
    if (!same(base, item)) return [item]
    return local ? [local] : []
  })
  return [...result, ...draft.filter((item) => !baseline.some((row) => row.id === item.id) && !confirmed.some((row) => row.id === item.id))]
}
