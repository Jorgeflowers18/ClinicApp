import { z } from "zod"

export const genderOptions = [
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "otro", label: "Otro" },
] as const

export const treatmentStatusOptions = [
  { value: "activo", label: "Activo" },
  { value: "en seguimiento", label: "En seguimiento" },
  { value: "pendiente", label: "Pendiente" },
  { value: "inactivo", label: "Inactivo" },
] as const

export const treatmentStatusLabels: Record<string, string> = {
  activo: "Activo",
  "en seguimiento": "En seguimiento",
  pendiente: "Pendiente",
  inactivo: "Inactivo",
}

export const patientSchema = z.object({
  firstName: z.string().min(2, "Mínimo 2 caracteres"),
  lastName: z.string().min(2, "Mínimo 2 caracteres"),
  documentId: z.string().min(5, "Documento inválido"),
  birthDate: z.string().min(1, "La fecha de nacimiento es obligatoria"),
  gender: z.enum(["femenino", "masculino", "otro"], {
    message: "Selecciona un género",
  }),
  phone: z.string().min(7, "Teléfono inválido"),
  email: z.string().email("Correo inválido").or(z.literal("")).default(""),
  address: z.string().default(""),
  notes: z.string().default(""),
  notificationsEnabled: z.boolean().default(true),
  medicalHistory: z.string().default(""),
  allergies: z.string().default(""),
  emergencyContactName: z.string().default(""),
  emergencyContactPhone: z.string().default(""),
  insuranceProvider: z.string().default(""),
  insurancePolicy: z.string().default(""),
  consentSigned: z.boolean().default(false),
  treatmentStatus: z.enum(["activo", "en seguimiento", "pendiente", "inactivo"]).default("activo"),
  lastVisitAt: z.string().default(""),
})

export type PatientFormValues = z.infer<typeof patientSchema>

export interface Patient extends PatientFormValues {
  id: string
  createdAt: string
}
