import type { NavItem } from "@/app/nav-config"
import type { AuthUser } from "@/modules/auth/types/auth.types"
import type { SaasData, StaffUser } from "../types"
import { demoCan, permissionModuleForPath } from "./permissions"
import { assignedRoles } from "./access-catalogs"

/** Mirrors the current route guards for navigation; server authorization remains unchanged. */
export function canViewNavigationItem(item: Pick<NavItem, "to" | "roles">, context: {
  user: Pick<AuthUser, "id" | "role"> | null; member?: StaffUser; data: SaasData; organizationId: string
}) {
  const { user, member, data, organizationId } = context
  if (!user) return false
  const module = permissionModuleForPath(item.to)
  if (member) return !module || demoCan(member, data, module, "view", organizationId)
  if (item.roles && !item.roles.includes(user.role)) return false
  const settings = data.serverStaffSettings?.[organizationId]?.[user.id]
  return !settings || !module || assignedRoles({ roles: [user.role], accessRoleIds: settings.accessRoleIds }, data, organizationId)
    .some(role => role.active && role.sections.includes(module))
}
