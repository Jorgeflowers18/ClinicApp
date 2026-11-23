import type { ManagedUser, PasswordLink, UserFormValues } from "../types/user-admin.types"

/**
 * Gestión de usuarios (solo admin; `403` si no). Las cuentas no se borran: se desactivan.
 *
 * El servidor valida: correo repetido (`409` `errors.email`), profesional ya vinculado (`409`
 * `errors.professionalId`), y que el admin no se desactive ni se quite el rol (`409` `errors.active` / `errors.role`).
 */
export interface UsersApi {
  /** Todas, también las inactivas, por nombre. */
  list(signal?: AbortSignal): Promise<ManagedUser[]>
  /** La cuenta nueva no tiene contraseña: el enlace es para que la persona la elija. */
  create(values: UserFormValues): Promise<{ user: ManagedUser; passwordLink: PasswordLink }>
  update(id: string, values: UserFormValues): Promise<ManagedUser>
  /** Un enlace nuevo para elegir la contraseña; el anterior deja de valer. */
  createPasswordLink(id: string): Promise<PasswordLink>
}
