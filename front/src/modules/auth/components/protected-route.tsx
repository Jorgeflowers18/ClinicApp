import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuthStore } from "../store/auth-store"
import type { Role } from "../types/auth.types"

interface ProtectedRouteProps {
  allowedRoles?: Role[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const profileNeedsSetup = !user.profile || !user.profile.fullName?.trim()
  if (location.pathname !== "/perfil-usuario" && profileNeedsSetup) {
    return <Navigate to="/perfil-usuario" replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}
