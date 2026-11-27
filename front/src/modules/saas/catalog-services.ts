import { ApiError } from "@/shared/types/common"
import { navigationSections } from "@/app/nav-config"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { readDemoData, updateDemoData, recordAudit, assertUsernameAvailable } from "./adapters/demo-repository"
import { useDemoContext } from "./state"
import { activeInstitutionScope, confirmedStaffInstitution } from "./lib/institution-scope"
import { documentValidationMessage } from "@/shared/lib/ecuadorian-cedula"
import { accessRoles, isInstitutionAdministrator } from "./lib/access-catalogs"
import type { AccessRole, ProfessionalType, SaasData, StaffSettings } from "./types"

export function administrativeActor() {
  const context = useDemoContext.getState(), data = readDemoData()
  if (context.userId) {
    const member = data.users.find(item => item.id === context.userId)
    if (member && isInstitutionAdministrator(member, data, context.organizationId)) return member.id
  } else if (useAuthStore.getState().user?.role === "admin") return useAuthStore.getState().user!.id
  throw new ApiError("Se requiere autorización administrativa.", 403)
}
export function protectAdministration(before: SaasData, after: SaasData, scope: string, actorId: string) {
  const admins = before.users.filter(user => isInstitutionAdministrator(user, before, scope))
  if (admins.length && !after.users.some(user => isInstitutionAdministrator(user, after, scope))) throw new ApiError("Conserva al menos un administrador activo con acceso a usuarios y roles.", 409, [{ field: "accessRoleIds", message: "No puedes dejar la institución sin administración." }])
  const actorBefore = admins.find(user => user.id === actorId)
  if (actorBefore && !after.users.some(user => user.id === actorId && isInstitutionAdministrator(user, after, scope))) throw new ApiError("Tu cuenta debe conservar el acceso a la administración.", 409, [{ field: "accessRoleIds", message: "Conserva un rol administrativo en tu propia cuenta." }])
}
const normalized = (value: string) => value.trim().normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es")
export const catalogService = {
  async saveRole(role: AccessRole) {
    const actor = administrativeActor(), scope = activeInstitutionScope(), before = readDemoData()
    if (role.organizationId !== scope) throw new ApiError("El rol no pertenece a esta institución.", 403)
    const current = accessRoles(before, scope).find(item => item.id === role.id)
    if (!role.name.trim()) throw new ApiError("Revisa el rol.", 422, [{ field: "name", message: "Ingresa el nombre del rol." }])
    if (accessRoles(before, scope).some(item => item.id !== role.id && normalized(item.name) === normalized(role.name))) throw new ApiError("Nombre duplicado.", 409, [{ field: "name", message: "Ya existe un rol con ese nombre." }])
    if (role.sections.some(id => !navigationSections.some(item => item.id === id))) throw new ApiError("Revisa los módulos.", 422, [{ field: "sections", message: "Selecciona secciones existentes de ClinicApp." }])
    const saved = { ...role, name: role.name.trim(), builtin: current?.builtin }
    if (current?.builtin === "admin" && (!saved.active || saved.name !== current.name || !["Administración", "Personal y accesos"].every(id => saved.sections.includes(id)))) throw new ApiError("El rol Administrador está protegido.", 409, [{ field: "sections", message: "El administrador debe conservar acceso a usuarios y administración y permanecer activo." }])
    updateDemoData(next => {
      next.accessRoles = [...(next.accessRoles ?? []).filter(item => item.id !== saved.id), saved]
      protectAdministration(before, next, scope, actor)
      recordAudit(next, actor, saved.id, "Guardar rol local")
    })
  },
  async saveType(type: ProfessionalType) {
    const actor = administrativeActor(), scope = activeInstitutionScope()
    if (type.organizationId !== scope) throw new ApiError("El tipo no pertenece a esta institución.", 403)
    if (!type.name.trim()) throw new ApiError("Revisa el tipo.", 422, [{ field: "name", message: "Ingresa el nombre del tipo profesional." }])
    updateDemoData(next => {
      if (next.professionalTypes?.some(item => item.organizationId === scope && item.id !== type.id && normalized(item.name) === normalized(type.name))) throw new ApiError("Nombre duplicado.", 409, [{ field: "name", message: "Ya existe un tipo profesional con ese nombre." }])
      next.professionalTypes = [...(next.professionalTypes ?? []).filter(item => item.id !== type.id), { ...type, name: type.name.trim() }]
      recordAudit(next, actor, type.id, "Guardar tipo profesional")
    })
  },
  async saveServerSettings(id: string, settings: StaffSettings, professionalId?: string | null) {
    const actor = administrativeActor(), scope = activeInstitutionScope()
    const data = readDemoData(), roles = accessRoles(data, scope), stored = data.serverStaffSettings?.[scope] ?? {}, old = stored[id] ?? (professionalId ? stored["professional:" + professionalId] : undefined)
    if (useAuthStore.getState().user?.id === id && useAuthStore.getState().user?.role === "admin" && !roles.some(role => role.builtin === "admin" && settings.accessRoleIds.includes(role.id))) throw new ApiError("Conserva el acceso administrativo en tu cuenta.", 409)
    if (settings.accessRoleIds.some(roleId => !roles.some(role => role.id === roleId && (role.active || old?.accessRoleIds.includes(roleId))))) throw new ApiError("Revisa los roles.", 422, [{ field: "accessRoleIds", message: "Selecciona roles activos de esta institución." }])
    if (settings.professionalTypeId && settings.professionalTypeId !== old?.professionalTypeId && !data.professionalTypes?.some(type => type.id === settings.professionalTypeId && type.organizationId === scope && type.active)) throw new ApiError("Revisa el tipo profesional.", 422, [{ field: "professionalTypeId", message: "Selecciona un tipo profesional activo de esta institución." }])
    if (settings.username) assertUsernameAvailable(settings.username, id)
    const documentError = documentValidationMessage(settings.documentType ?? "otro", settings.documentNumber ?? "")
    if (documentError) throw new ApiError("Revisa el documento.", 422, [{ field: "documentNumber", message: documentError }])
    updateDemoData(next => {
      next.serverStaffSettings ??= {}; next.serverStaffSettings[scope] ??= {}; next.serverStaffSettings[scope][id] = settings
      const identity = next.identities.find(item => item.id === id)
      if (identity) { if (settings.username !== undefined) identity.username = settings.username; if (settings.email !== undefined) identity.email = settings.email }
      recordAudit(next, actor, id, "Guardar configuración frontend de personal")
    })
  },
  async setBranchActive(id: string, active: boolean) {
    const actor = administrativeActor(), scope = activeInstitutionScope()
    if (!confirmedStaffInstitution()?.branches.some(branch => branch.id === id)) throw new ApiError("Esta sede ya no está disponible en la institución actual.", 404)
    updateDemoData(next => { next.branchStates ??= {}; next.branchStates[scope] ??= {}; next.branchStates[scope][id] = active; recordAudit(next, actor, id, active ? "Activar sede local" : "Desactivar sede local") })
  },
}
