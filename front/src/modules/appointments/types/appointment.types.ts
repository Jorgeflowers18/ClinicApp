import { z } from "zod"

export const appointmentStatuses = ["programada", "confirmada", "cancelada", "completada"] as const
export type AppointmentStatus = (typeof appointmentStatuses)[number]

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada",
}

export interface Professional {
  id: string
  name: string
  specialty: string
}

export const appointmentSchema = z
  .object({
    patientId: z.string().min(1, "Selecciona un paciente"),
    professionalId: z.string().min(1, "Selecciona un profesional"),
    treatmentId: z.string().optional(),
    date: z.string().min(1, "La fecha es obligatoria"),
    startTime: z.string().min(1, "La hora de inicio es obligatoria"),
    endTime: z.string().min(1, "La hora de fin es obligatoria"),
    notes: z.string().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "La hora de fin debe ser posterior a la de inicio",
    path: ["endTime"],
  })

export type AppointmentFormValues = z.infer<typeof appointmentSchema>

export interface Appointment {
  id: string
  patientId: string
  professionalId: string
  treatmentId?: string
  start: string
  end: string
  status: AppointmentStatus
  notes?: string
  createdAt: string
}
