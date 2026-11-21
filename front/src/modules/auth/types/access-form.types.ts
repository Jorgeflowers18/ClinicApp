import { z } from "zod"

// Recuperar contraseña y solicitar acceso: se envían con `authApi` (en demostración no salen del navegador).
export const recoverySchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido"),
})

export const accessRequestSchema = recoverySchema.extend({
  fullName: z.string().trim().min(1, "El nombre completo es obligatorio"),
  institution: z.string(),
  message: z.string(),
})

export type RecoveryFormValues = z.infer<typeof recoverySchema>
export type AccessRequestFormValues = z.infer<typeof accessRequestSchema>
