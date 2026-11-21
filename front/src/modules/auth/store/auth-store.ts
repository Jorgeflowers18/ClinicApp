import { create } from "zustand"

import { queryClient } from "@/shared/lib/query-client"

import { authApi } from "../api/auth.api"
import type { AuthSession, AuthUser, UserProfile } from "../types/auth.types"

/**
 * - `checking`: al cargar con la API, mientras `POST /auth/refresh` dice si la cookie sigue valiendo.
 * - `authenticated` / `anonymous`: ya se sabe.
 */
export type SessionStatus = "checking" | "authenticated" | "anonymous"

interface AuthState {
  status: SessionStatus
  accessToken: string | null
  user: AuthUser | null
  setSession: (token: string, user: AuthUser) => void
  updateUserProfile: (profile: UserProfile) => Promise<void>
  clearSession: () => void
}

function initialState(): Pick<AuthState, "status" | "accessToken" | "user"> {
  const session = authApi.sessionCache.initial()
  if (session === undefined) return { status: "checking", accessToken: null, user: null }
  return session ? { status: "authenticated", ...session } : { status: "anonymous", accessToken: null, user: null }
}

/**
 * El access token vive solo en memoria (nunca en localStorage ni sessionStorage), para que un XSS no pueda
 * llevárselo. Con la API, al recargar se restaura con `POST /auth/refresh` y la cookie httpOnly
 * (`restoreSession` en `session.ts`).
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialState(),
  setSession: (accessToken, user) => {
    const session: AuthSession = authApi.sessionCache.started({ accessToken, user })
    set({ status: "authenticated", ...session })
  },
  updateUserProfile: async (profile) => {
    const { accessToken, user } = get()
    if (!user || !accessToken) throw new Error("Inicia sesión para guardar el perfil.")
    const updated = await authApi.updateProfile(profile, { accessToken, user })
    // Si mientras tanto se cerró o cambió la sesión, no se revive.
    if (get().user?.id === user.id) set({ user: updated })
  },
  clearSession: () => {
    authApi.sessionCache.cleared(get().user)
    set({ status: "anonymous", accessToken: null, user: null })
    queryClient.clear()
  },
}))

export function getAccessToken() {
  return useAuthStore.getState().accessToken
}
