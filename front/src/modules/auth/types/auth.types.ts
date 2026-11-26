import { z } from "zod"
import { identifierSchema } from "@/modules/saas/lib/identity"

export const roles = ["admin", "recepcion", "medico"] as const
export type Role = (typeof roles)[number]

export interface UserProfile {
  fullName: string
  title: string
  specialty: string
  bio: string
  avatarColor: string
  avatarImage: string | null
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  /** El profesional de la agenda que corresponde a este usuario, si lo hay. */
  professionalId: string | null
  profile: UserProfile | null
}

export interface LoginResponse {
  accessToken: string
  expiresIn: number
  user: AuthUser
}

export interface AuthSession {
  accessToken: string
  user: AuthUser
}

export const loginSchema = z.object({
  email: identifierSchema,
  password: z.string().min(1, "La contraseña es obligatoria"),
  /**
   * "Recordarme". Sin marcar, la sesión termina al cerrar el navegador (o tras 12 horas sin uso): lo seguro en
   * equipos compartidos. Marcado, dura 7 días desde el último uso.
   */
  rememberMe: z.boolean(),
})

export type LoginFormValues = z.infer<typeof loginSchema>

/** Contraseña nueva: los mismos límites que la API (8 a 128 caracteres). */
export const passwordResetSchema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres").max(128, "Máximo 128 caracteres"),
  confirmation: z.string(),
}).refine((values) => values.password === values.confirmation, {
  path: ["confirmation"],
  message: "Las contraseñas no coinciden",
})

export type PasswordResetFormValues = z.infer<typeof passwordResetSchema>
