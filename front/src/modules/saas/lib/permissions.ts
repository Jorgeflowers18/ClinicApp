import { navItems } from "@/app/nav-config"
import type { SaasData, StaffUser } from "../types"
import { allowedSections, defaultGrant, isInstitutionAdministrator } from "./access-catalogs"
export { defaultGrant } from "./access-catalogs"

/** Local visibility is additive across active roles; detailed legacy capabilities stay intact. */
export function demoCan(user: StaffUser, data: SaasData, module: string, action: string, organizationId = user.organizationIds[0]) {
  const visible = allowedSections(user, data, organizationId).includes(module)
  if (!visible) return false
  if (module === "Administración" && !isInstitutionAdministrator(user, data, organizationId)) return false
  if (action === "view" || isInstitutionAdministrator(user, data, organizationId)) return true
  return user.roles.some(role => defaultGrant(role, module, action))
}
export function permissionModuleForPath(path: string) {
  if (/^\/administracion(?:\/|$)/.test(path)) return "Administración"
  if (/^\/personal-accesos(?:\/|$)/.test(path)) return "Personal y accesos"
  if (/^\/perfil-institucion(?:\/|$)/.test(path)) return "Perfil institucional"
  const item = navItems.find(item => item.to === "/" ? path === "/" : path === item.to || path.startsWith(item.to + "/"))
  return item ? item.module ?? (item.to === "/historial-clinico" ? "Historia clínica" : item.label) : null
}
