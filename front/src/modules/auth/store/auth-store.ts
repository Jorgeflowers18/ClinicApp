import { create } from "zustand"

import { queryClient } from "@/shared/lib/query-client"

import { authApi } from "../api/auth.api"
import type { AuthUser, UserProfile } from "../types/auth.types"

/**
 * - `checking`: al cargar, mientras `POST /auth/refresh` dice si la cookie de renovación sigue valiendo.
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

/**
 * El access token vive solo en memoria (nunca en localStorage ni sessionStorage), para que un XSS no pueda
 * llevárselo. Al recargar se restaura con `POST /auth/refresh` y la cookie httpOnly (`startSession` en
 * `lib/session.ts`).
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  status: "checking",
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ status: "authenticated", accessToken, user }),
  updateUserProfile: async (profile) => {
    const { user } = get()
    if (!user) throw new Error("Inicia sesión para guardar el perfil.")
    const updated = await authApi.updateProfile(profile)
    // Si mientras tanto se cerró o cambió la sesión, no se revive.
    if (get().user?.id === user.id) set({ user: updated })
  },
  clearSession: () => {
    set({ status: "anonymous", accessToken: null, user: null })
    queryClient.clear()
  },
}))

export function getAccessToken() {
  return useAuthStore.getState().accessToken
}
