export type RoleModule = { id: string; label: string }
export type RoleModuleGroup = { id: "clinical" | "operations" | "configuration"; label: string; modules: RoleModule[] }
const clinical = new Set(["Pacientes", "Citas", "Historia clínica", "Tratamientos"])
const configuration = new Set(["Personal y accesos", "Administración", "Perfil institucional"])

/** Group the real navigation catalog without inventing, duplicating or renaming permission IDs. */
export function groupRoleModules(catalog: readonly RoleModule[]): RoleModuleGroup[] {
  const groups: RoleModuleGroup[] = [
    { id: "clinical", label: "Atención clínica", modules: [] },
    { id: "operations", label: "Operación", modules: [] },
    { id: "configuration", label: "Configuración", modules: [] },
  ]
  const seen = new Set<string>()
  for (const module of catalog) {
    if (seen.has(module.id)) continue
    seen.add(module.id)
    groups[clinical.has(module.id) ? 0 : configuration.has(module.id) ? 2 : 1].modules.push(module)
  }
  return groups
}
export const enabledModuleCount = (catalog: readonly RoleModule[], selected: readonly string[]) => new Set(catalog.filter(module => selected.includes(module.id)).map(module => module.id)).size

export const protectedRoleModuleIds: readonly string[] = ["Administración", "Personal y accesos"]

/** The same editable subset is used by individual, group and general controls. */
export function editableRoleModuleIds(catalog: readonly RoleModule[], { protectedRole = false, assignableIds }: {
  protectedRole?: boolean; assignableIds?: readonly string[]
} = {}) {
  return [...new Set(catalog.filter(module => (!protectedRole || !protectedRoleModuleIds.includes(module.id))
    && (!assignableIds || assignableIds.includes(module.id))).map(module => module.id))]
}

/** Only change the supplied editable targets, preserving every other saved grant. */
export function updateRoleModuleSelection(selected: readonly string[], editableIds: readonly string[], enabled: boolean) {
  const next = new Set(selected)
  for (const id of editableIds) {
    if (enabled) next.add(id)
    else next.delete(id)
  }
  return [...next]
}
