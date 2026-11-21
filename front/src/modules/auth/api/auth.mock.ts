import { mockDelay } from "@/shared/lib/mock"
import { ApiError } from "@/shared/types/common"

import type { AuthApi } from "./auth.contract"
import type { AuthSession, AuthUser, LoginFormValues, LoginResponse, UserProfile } from "../types/auth.types"

const MOCK_ACCOUNTS: Array<{ password: string; user: AuthUser }> = [
  {
    password: "admin123",
    user: { id: "usr_1", name: "Ana Morales", email: "admin@clinica.com", role: "admin", professionalId: null, profile: null },
  },
  {
    password: "recepcion123",
    user: { id: "usr_2", name: "Luis Fernández", email: "recepcion@clinica.com", role: "recepcion", professionalId: null, profile: null },
  },
  {
    password: "medico123",
    user: { id: "usr_3", name: "Dra. Carla Ríos", email: "medico@clinica.com", role: "medico", professionalId: null, profile: null },
  },
]

// ───────────── "Mi perfil" de demostración, uno por usuario en localStorage ─────────────

export const mockProfileKey = (userId: string) => `clinicapp.mock-profile.${encodeURIComponent(userId)}`
const unreadableProfile = "No se pudo leer el perfil guardado. No se han modificado tus datos."

/** Un perfil, nunca un token de acceso. */
function readSavedProfile(userId: string): UserProfile | null | undefined {
  const raw = localStorage.getItem(mockProfileKey(userId))
  if (raw === null) return undefined
  let value: unknown
  try { value = JSON.parse(raw) } catch (cause) { throw new Error(unreadableProfile, { cause }) }
  if (value === null) return null
  if (typeof value !== "object") throw new Error(unreadableProfile)
  const profile = value as Record<string, unknown>
  if (!["fullName", "title", "specialty", "bio", "avatarColor"].every((key) => typeof profile[key] === "string")
    || !(profile.avatarImage === null || typeof profile.avatarImage === "string")) {
    throw new Error(unreadableProfile)
  }
  return value as UserProfile
}

/** setItem reemplaza el registro de una vez; si falla (cuota), el anterior queda intacto. */
function persistProfile(userId: string, profile: UserProfile | null): void {
  try {
    // Nunca sobrescribir un registro ilegible con un perfil nuevo por defecto.
    readSavedProfile(userId)
    localStorage.setItem(mockProfileKey(userId), JSON.stringify(profile))
  } catch (cause) {
    throw new Error("No se pudo guardar el perfil en este navegador. Tus datos anteriores se conservan. Revisa el espacio y los permisos de almacenamiento.", { cause })
  }
}

// ───────────── Sesión de demostración en sessionStorage, para no volver a entrar en cada recarga ─────────────

const MOCK_SESSION_KEY = "clinicapp.mock-session"

function readMockSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(MOCK_SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as AuthSession
    try {
      const saved = readSavedProfile(session.user.id)
      if (saved !== undefined) session.user = { ...session.user, profile: saved }
    } catch {
      // Se conserva el perfil de la sesión; guardar sobre un registro ilegible sigue bloqueado.
    }
    session.user = { ...session.user, professionalId: session.user.professionalId ?? null }
    return session
  } catch {
    return null
  }
}

async function loginMock(values: LoginFormValues): Promise<LoginResponse> {
  await mockDelay(500)
  const account = MOCK_ACCOUNTS.find((entry) => entry.user.email === values.email)
  if (!account || account.password !== values.password) {
    throw new ApiError("Correo o contraseña incorrectos", 401)
  }
  return { accessToken: `mock-token.${account.user.id}.${Date.now()}`, expiresIn: 3600, user: account.user }
}

export const mockAuthApi: AuthApi = {
  login: loginMock,
  // Sin servidor no hay cookie de renovación: la sesión de demostración vive en sessionStorage.
  refresh: async () => null,
  logout: async () => { await mockDelay(150) },
  async updateProfile(profile, session) {
    persistProfile(session.user.id, profile)
    const user = { ...session.user, profile }
    // El perfil por usuario de arriba es el registro válido; esto es solo la copia de la sesión.
    try {
      sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify({ accessToken: session.accessToken, user }))
    } catch {
      // No dejar una foto vieja en la copia de la sesión después de guardar el perfil.
      try { sessionStorage.removeItem(MOCK_SESSION_KEY) } catch { /* El almacenamiento puede no estar disponible. */ }
    }
    return user
  },
  requestPasswordRecovery: async () => { await mockDelay(300) },
  resetPassword: async () => { await mockDelay(300) },
  requestAccess: async () => { await mockDelay(300) },
  sessionCache: {
    initial: readMockSession,
    started(session) {
      let saved: UserProfile | null | undefined
      try {
        saved = readSavedProfile(session.user.id)
      } catch {
        // Como un 4xx del servidor: el login muestra el mensaje y no entra con un perfil vacío.
        throw new ApiError(unreadableProfile, 400, undefined, { code: "UNREADABLE_PROFILE" })
      }
      const restored = saved === undefined ? session : { ...session, user: { ...session.user, profile: saved } }
      sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(restored))
      return restored
    },
    cleared(user) {
      // Conservar los perfiles antiguos que solo estaban en la sesión antes de cerrarla.
      if (user?.profile && readSavedProfile(user.id) === undefined) persistProfile(user.id, user.profile)
      sessionStorage.removeItem(MOCK_SESSION_KEY)
    },
  },
}
