import type { Specialty } from "../types"
export const normalizedCatalogName = (value: string) => value.trim().normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es")
export function specialtyCompatible(specialty: Specialty, typeId: string | null | undefined) {
  return !specialty.professionalTypeIds?.length || Boolean(typeId && specialty.professionalTypeIds.includes(typeId))
}
export function specialtySelectionError(catalog: Specialty[], ids: string[], typeId: string | null | undefined, previousIds: string[] = [], previousType?: string | null) {
  for (const id of ids) {
    const specialty = catalog.find(item => item.id === id)
    if (!specialty) return "Una especialidad ya no está disponible. Revisa la selección."
    if (!specialty.active && !previousIds.includes(id)) return "Selecciona especialidades activas."
    if (!specialtyCompatible(specialty, typeId) && !(previousIds.includes(id) && typeId === previousType)) return "Revisa las especialidades: alguna no es compatible con el tipo profesional seleccionado."
  }
  return ""
}
