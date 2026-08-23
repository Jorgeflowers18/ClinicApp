import { z } from "zod"

export const clinicalHistorySchema = z.object({
  patientId: z.string().min(1, "Selecciona un paciente"),
  professionalId: z.string().min(1, "Selecciona un profesional"),
  date: z.string().min(1, "La fecha es obligatoria"),
  reason: z.string().min(3, "Describe el motivo de consulta"),
  diagnosis: z.string().min(3, "Describe el diagnóstico"),
  treatmentNotes: z.string().optional(),
  attachments: z.array(z.string()),
})

export type ClinicalHistoryFormValues = z.infer<typeof clinicalHistorySchema>

export interface ClinicalHistoryEntry extends ClinicalHistoryFormValues {
  id: string
  createdAt: string
}
