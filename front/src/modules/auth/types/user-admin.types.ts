import { z } from "zod"

import { roles, type Role } from "./auth.types"

export const roleLabels: Record<Role, string> = { admin: "Administrador", recepcion: "Recepción", medico: "Personal médico" }

/** Cuenta de usuario en la pantalla de administración (`GET /users`, solo admin). */
export interface ManagedUser {
  id: string
  name: string
  email: string
  role: Role
  professionalId: string | null
  /** Nombre del profesional vinculado, o `null`. */
  professionalName: string | null
  active: boolean
  createdAt: string
  lastLoginAt: string | null
}

/** Enlace de un solo uso para elegir la contraseña. Solo llega en la respuesta que lo crea. */
export interface PasswordLink {
  url: string
  expiresAt: string
}

/** Las mismas reglas que `UserCreateRequest` / `UserUpdateRequest` del back. `professionalId` vacío: sin profesional. */
export const userSchema = z.object({
  name: z.string().trim().min(3, "Mínimo 3 caracteres").max(120, "Máximo 120 caracteres"),
  email: z.string().trim().min(1, "El correo es obligatorio").max(254, "Máximo 254 caracteres").email("Ingresa un correo válido"),
  role: z.enum(roles, { errorMap: () => ({ message: "Elige un rol" }) }),
  professionalId: z.string(),
  active: z.boolean(),
})
export type UserFormValues = z.infer<typeof userSchema>
