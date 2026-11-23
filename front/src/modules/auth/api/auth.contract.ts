import type { AccessRequestFormValues } from "../types/access-form.types"
import type { AuthUser, LoginFormValues, LoginResponse, UserProfile } from "../types/auth.types"

/**
 * Lo que la app necesita de la autenticación. `auth.http.ts` lo cumple con la API. La sesión sobrevive a la
 * recarga con la cookie httpOnly de renovación: el token nunca se guarda en el navegador.
 */
export interface AuthApi {
  login(values: LoginFormValues): Promise<LoginResponse>
  /** Renueva la sesión con la cookie httpOnly de renovación. `null` si no hay sesión (o ya venció). */
  refresh(): Promise<LoginResponse | null>
  logout(): Promise<void>
  /** Guarda "Mi perfil" de la sesión actual y devuelve el usuario actualizado. */
  updateProfile(profile: UserProfile): Promise<AuthUser>
  /** Siempre se resuelve (el servidor no revela si el correo existe). */
  requestPasswordRecovery(email: string): Promise<void>
  resetPassword(token: string, password: string): Promise<void>
  requestAccess(values: AccessRequestFormValues): Promise<void>
}

