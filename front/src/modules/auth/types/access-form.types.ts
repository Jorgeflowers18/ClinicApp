import { z } from "zod"
import { identifierSchema,usernameSchema } from "@/modules/saas/lib/identity"

// Recuperar contraseña y solicitar acceso: se envían con `authApi`.
export const recoverySchema = z.object({
  email: identifierSchema,
})

export const accessRequestSchema = recoverySchema.extend({
  email: z.string().trim().email("Ingresa un correo válido"),
  requestedUsername: usernameSchema.or(z.literal("")).optional(),
  firstName:z.string().optional(),
  lastName:z.string().optional(),
  fullName: z.string().trim().min(1, "El nombre completo es obligatorio"),
  institution: z.string(),
  message: z.string(),
})

export type RecoveryFormValues = z.infer<typeof recoverySchema>
export type AccessRequestFormValues = z.infer<typeof accessRequestSchema>
