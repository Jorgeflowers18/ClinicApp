import type { AccessRequestFormValues } from "../types/access-form.types"
import type { AuthSession, AuthUser, LoginFormValues, LoginResponse, UserProfile } from "../types/auth.types"

/**
 * Lo que la app necesita de la autenticación. `auth.http.ts` lo cumple con la API y `auth.mock.ts` con las
 * cuentas de demostración; `auth.api.ts` elige una de las dos con `env.usesApi("auth")`.
 */
export interface AuthApi {
  login(values: LoginFormValues): Promise<LoginResponse>
  /** Renueva la sesión con la cookie httpOnly de renovación. `null` si no hay sesión (o ya venció). */
  refresh(): Promise<LoginResponse | null>
  logout(): Promise<void>
  /** Guarda "Mi perfil" de la sesión actual y devuelve el usuario actualizado. */
  updateProfile(profile: UserProfile, session: AuthSession): Promise<AuthUser>
  /** Siempre se resuelve (el servidor no revela si el correo existe). */
  requestPasswordRecovery(email: string): Promise<void>
  resetPassword(token: string, password: string): Promise<void>
  requestAccess(values: AccessRequestFormValues): Promise<void>
  sessionCache: SessionCache
}

/**
 * Cómo sobrevive la sesión a una recarga. Con la API, la cookie httpOnly hace ese trabajo y el token queda
 * solo en memoria: estos métodos no hacen nada. En demostración se guarda en `sessionStorage`.
 */
export interface SessionCache {
  /** La sesión disponible al cargar sin preguntar al servidor; `undefined` = hay que preguntarle (refresh). */
  initial(): AuthSession | null | undefined
  /** Al iniciar o renovar la sesión. Devuelve la sesión a usar (el mock le pone el perfil guardado). */
  started(session: AuthSession): AuthSession
  cleared(user: AuthUser | null): void
}
