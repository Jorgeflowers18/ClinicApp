import { create } from "zustand"

import { env } from "@/shared/lib/env"

import type { AuthUser, UserProfile } from "../types/auth.types"
import { persistProfile, readSavedProfile } from "../api/profile-persistence"

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  setSession: (token: string, user: AuthUser) => void
  updateUserProfile: (profile: UserProfile | null) => void
  clearSession: () => void
}

const MOCK_SESSION_KEY = "clinicapp.mock-session"

/**
 * Solo aplica en modo mock (sin backend real): persiste la sesión en sessionStorage
 * para no tener que volver a iniciar sesión en cada recarga durante el desarrollo.
 * Con la API .NET real esto se elimina: la sesión se restaura vía /auth/me apoyada
 * en una cookie httpOnly de refresh, nunca en storage accesible por JavaScript.
 */
function readMockSession(): Pick<AuthState, "accessToken" | "user"> {
  if (!env.useMockApi) return { accessToken: null, user: null }
  try {
    const raw = sessionStorage.getItem(MOCK_SESSION_KEY)
    if (!raw) return { accessToken: null, user: null }
    const session = JSON.parse(raw)
    try {
      const saved = readSavedProfile(session.user.id)
      if (saved !== undefined) session.user = { ...session.user, profile: saved }
    } catch {
      // Keep the previous session profile readable. Saving an unreadable record remains blocked.
    }
    return session
  } catch {
    return { accessToken: null, user: null }
  }
}

/**
 * El access token vive solo en memoria (no persiste en localStorage/sessionStorage)
 * para reducir la superficie de robo de token vía XSS. Al recargar la página se
 * pierde y el bootstrap de la app intenta restaurar la sesión llamando a /auth/me,
 * que en el backend real dependerá de una cookie httpOnly de refresh.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  ...readMockSession(),
  setSession: (accessToken, user) => {
    const saved = readSavedProfile(user.id)
    const restoredUser = saved === undefined ? user : { ...user, profile: saved }
    if (env.useMockApi) {
      sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify({ accessToken, user: restoredUser }))
    }
    set({ accessToken, user: restoredUser })
  },
  updateUserProfile: (profile) => {
    const state = get()
    if (!state.user) throw new Error("Inicia sesión para guardar el perfil.")
    persistProfile(state.user.id, profile)
    const nextUser = { ...state.user, profile }
    // The per-user profile above is authoritative. This is only the existing mock-session cache.
    try {
      sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify({ accessToken: state.accessToken, user: nextUser }))
    } catch {
      // Avoid keeping an outdated image in the session cache after a successful profile commit.
      try { sessionStorage.removeItem(MOCK_SESSION_KEY) } catch { /* Browser storage may be unavailable. */ }
    }
    set({ user: nextUser })
  },
  clearSession: () => {
    if (env.useMockApi) {
      const user = get().user
      // Preserve legacy profiles previously stored only in the session before signing out.
      if (user?.profile && readSavedProfile(user.id) === undefined) persistProfile(user.id, user.profile)
      sessionStorage.removeItem(MOCK_SESSION_KEY)
    }
    set({ accessToken: null, user: null })
  },
}))

export function getAccessToken() {
  return useAuthStore.getState().accessToken
}
