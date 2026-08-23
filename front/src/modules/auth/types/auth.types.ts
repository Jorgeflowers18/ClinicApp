import { z } from "zod"

export const roles = ["admin", "recepcion", "medico"] as const
export type Role = (typeof roles)[number]

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
}

export interface LoginResponse {
  accessToken: string
  expiresIn: number
  user: AuthUser
}

export const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
})

export type LoginFormValues = z.infer<typeof loginSchema>
