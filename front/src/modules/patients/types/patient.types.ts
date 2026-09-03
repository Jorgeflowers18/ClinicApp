import { z } from "zod"

export const genderOptions = [
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "otro", label: "Otro" },
] as const

export const patientSchema = z.object({
  firstName: z.string().min(2, "Mínimo 2 caracteres"),
  lastName: z.string().min(2, "Mínimo 2 caracteres"),
  documentId: z.string().min(5, "Documento inválido"),
  birthDate: z.string().min(1, "La fecha de nacimiento es obligatoria"),
  gender: z.enum(["femenino", "masculino", "otro"], {
    message: "Selecciona un género",
  }),
  phone: z.string().min(7, "Teléfono inválido"),
  email: z.string().email("Correo inválido").or(z.literal("")).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  notificationsEnabled: z.boolean(),
})

export type PatientFormValues = z.infer<typeof patientSchema>

export interface Patient extends PatientFormValues {
  id: string
  createdAt: string
}
