import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuthStore } from "../store/auth-store"
import type { Role } from "../types/auth.types"
import { SessionChecking } from "./session-checking"
import { useDemoContext,useSaasData,useSessionUser } from "@/modules/saas/state"
import { demoCan, permissionModuleForPath } from "@/modules/saas/lib/permissions"
import { assignedRoles } from "@/modules/saas/lib/access-catalogs"

interface ProtectedRouteProps {
  allowedRoles?: Role[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const status = useAuthStore((state) => state.status)
  const user = useSessionUser()
  const demo=useDemoContext(state=>state.userId),data=useSaasData(),member=data.users.find(item=>item.id===demo)
  const location = useLocation()

  // Al recargar con la API todavía no se sabe si hay sesión: no mandar al login antes de tiempo.
  if (status === "checking" && !demo) {
    return <SessionChecking />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if(member){
    if(["blocked","inactive"].includes(member.state))return <Navigate to="/login?demo=1" replace/>
    if(member.state==="pending")return location.pathname==="/activar-cuenta" ? <Outlet/> : <Navigate to="/activar-cuenta" replace/>
    if(member.mustChangePassword)return location.pathname==="/cambio-inicial-contrasena" ? <Outlet/> : <Navigate to="/cambio-inicial-contrasena" replace/>
    const module=permissionModuleForPath(location.pathname)
    if(module&&!demoCan(member,data,module,"view",useDemoContext.getState().organizationId))return <Navigate to="/403" replace/>
  }

  const profileNeedsSetup = !user.profile || !user.profile.fullName?.trim()
  if (location.pathname !== "/perfil-usuario" && profileNeedsSetup) {
    return <Navigate to="/perfil-usuario" replace state={{ from: location.pathname }} />
  }
  const settings = !member ? data.serverStaffSettings?.["frontend-institution-current"]?.[user.id] : undefined
  const module = permissionModuleForPath(location.pathname)
  if (settings && module && !assignedRoles({ roles: [user.role], accessRoleIds: settings.accessRoleIds }, data, "frontend-institution-current").some(role => role.active && role.sections.includes(module))) return <Navigate to="/403" replace />

  if (allowedRoles && !member && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}
