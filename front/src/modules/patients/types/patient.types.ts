import { z } from "zod"

export const genderOptions = [
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "otro", label: "Otro" },
] as const

export const genderLabels: Record<string, string> = Object.fromEntries(
  genderOptions.map((option) => [option.value, option.label])
)

export const maritalStatusOptions = [
  { value: "soltero", label: "Soltero/a" },
  { value: "casado", label: "Casado/a" },
  { value: "union_libre", label: "Unión libre" },
  { value: "divorciado", label: "Divorciado/a" },
  { value: "viudo", label: "Viudo/a" },
] as const

export const maritalStatusLabels: Record<string, string> = Object.fromEntries(
  maritalStatusOptions.map((option) => [option.value, option.label])
)

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
  maritalStatus: z.enum(["", "soltero", "casado", "union_libre", "divorciado", "viudo"]).default(""),
  occupation: z.string().max(120, "Máximo 120 caracteres").default(""),
  company: z.string().max(120, "Máximo 120 caracteres").default(""),
  nationality: z.string().max(60, "Máximo 60 caracteres").default(""),
  phone: z.string().min(7, "Teléfono inválido"),
  email: z.string().email("Correo inválido").or(z.literal("")).default(""),
  address: z.string().default(""),
  /** Ciudad / provincia. */
  city: z.string().max(120, "Máximo 120 caracteres").default(""),
  notes: z.string().default(""),
  notificationsEnabled: z.boolean().default(true),
  emergencyContactName: z.string().default(""),
  emergencyContactRelationship: z.string().max(60, "Máximo 60 caracteres").default(""),
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
  /** N.° de historia clínica, asignado automáticamente al registrar al paciente (solo lectura). */
  clinicalRecordNumber: string
  createdAt: string
}

/** Formato del N.° de historia clínica: HC-000123. */
export function formatClinicalRecordNumber(sequence: number) {
  return `HC-${String(sequence).padStart(6, "0")}`
}

/** Valores del formulario a partir de un paciente guardado (sin los datos que asigna el sistema). */
export function toPatientFormValues(patient: Patient): PatientFormValues {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    documentId: patient.documentId,
    birthDate: patient.birthDate,
    gender: patient.gender,
    maritalStatus: patient.maritalStatus ?? "",
    occupation: patient.occupation ?? "",
    company: patient.company ?? "",
    nationality: patient.nationality ?? "",
    phone: patient.phone,
    email: patient.email ?? "",
    address: patient.address ?? "",
    city: patient.city ?? "",
    notes: patient.notes ?? "",
    notificationsEnabled: patient.notificationsEnabled,
    emergencyContactName: patient.emergencyContactName ?? "",
    emergencyContactRelationship: patient.emergencyContactRelationship ?? "",
    emergencyContactPhone: patient.emergencyContactPhone ?? "",
    insuranceProvider: patient.insuranceProvider ?? "",
    insurancePolicy: patient.insurancePolicy ?? "",
    consentSigned: patient.consentSigned ?? false,
    treatmentStatus: patient.treatmentStatus ?? "activo",
    lastVisitAt: patient.lastVisitAt ?? "",
  }
}
