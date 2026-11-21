import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuthStore } from "../store/auth-store"
import type { Role } from "../types/auth.types"
import { SessionChecking } from "./session-checking"

interface ProtectedRouteProps {
  allowedRoles?: Role[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  // Al recargar con la API todavía no se sabe si hay sesión: no mandar al login antes de tiempo.
  if (status === "checking") {
    return <SessionChecking />
  }

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
