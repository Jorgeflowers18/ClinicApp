import { navigationSections } from "@/app/nav-config"
import type { Role } from "@/modules/auth/types/auth.types"
import { roleLabels } from "@/modules/auth/types/user-admin.types"
import type { AccessRole, SaasData, StaffUser } from "../types"

export function defaultGrant(role: Role, module: string, action: string) {
  if (role === "admin") return true
  if (module === "Panel" && action === "view") return true
  if (role === "medico") return ["Pacientes", "Citas", "Historia clínica", "Tratamientos"].includes(module) && ["view", "create", "edit", "export"].includes(action)
  return ["Pacientes", "Citas", "Tratamientos", "Inventario", "Finanzas", "Mensajería"].includes(module) && !["manage", "approve"].includes(action)
}
export const builtinRoleId = (organizationId: string, role: Role) => organizationId + ":role:" + role
export function accessRoles(data: SaasData, organizationId: string): AccessRole[] {
  const saved = data.accessRoles?.filter(item => item.organizationId === organizationId) ?? []
  return [...(["admin", "recepcion", "medico"] as const).filter(role => !saved.some(item => item.builtin === role)).map(role => ({
    id: builtinRoleId(organizationId, role), organizationId, name: roleLabels[role], description: "Rol existente de ClinicApp", active: true, builtin: role,
    sections: navigationSections.filter(section => defaultGrant(role, section.id, "view")).map(item => item.id),
  })), ...saved]
}
export function assignedRoles(user: Pick<StaffUser, "roles" | "accessRoleIds" | "roleAssignments">, data: SaasData, organizationId: string) {
  const ids = user.roleAssignments?.[organizationId] ?? user.accessRoleIds ?? user.roles.map(role => builtinRoleId(organizationId, role))
  return accessRoles(data, organizationId).filter(role => ids.includes(role.id))
}
export function allowedSections(user: StaffUser, data: SaasData, organizationId: string) {
  if (user.hasAccount === false || user.state !== "active" || !user.organizationIds.includes(organizationId)) return []
  return [...new Set(assignedRoles(user, data, organizationId).filter(role => role.active).flatMap(role => role.sections))]
}
export function isInstitutionAdministrator(user: StaffUser, data: SaasData, organizationId: string) {
  const sections = allowedSections(user, data, organizationId)
  return sections.includes("Administración") && sections.includes("Personal y accesos")
}
export const roleSummary = (user: Pick<StaffUser, "roles" | "accessRoleIds" | "roleAssignments">, data: SaasData, organizationId: string) => assignedRoles(user, data, organizationId).map(role => role.name).join(" · ") || "Sin roles asignados"
