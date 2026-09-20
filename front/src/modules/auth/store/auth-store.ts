import { create } from "zustand"

import { env } from "@/shared/lib/env"

import type { AuthUser, UserProfile } from "../types/auth.types"

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
    return JSON.parse(raw)
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
export const useAuthStore = create<AuthState>((set) => ({
  ...readMockSession(),
  setSession: (accessToken, user) => {
    if (env.useMockApi) {
      sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify({ accessToken, user }))
    }
    set({ accessToken, user })
  },
  updateUserProfile: (profile) => {
    set((state) => {
      if (!state.user) {
        return state
      }

      const nextUser = { ...state.user, profile }

      if (env.useMockApi) {
        sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify({ accessToken: state.accessToken, user: nextUser }))
      }

      return { ...state, user: nextUser }
    })
  },
  clearSession: () => {
    if (env.useMockApi) {
      sessionStorage.removeItem(MOCK_SESSION_KEY)
    }
    set({ accessToken: null, user: null })
  },
}))

export function getAccessToken() {
  return useAuthStore.getState().accessToken
}
