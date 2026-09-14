import { z } from "zod"

export const appointmentStatuses = [
  "programada",
  "confirmada",
  "cancelada",
  "completada",
  "no_asistio",
] as const
export type AppointmentStatus = (typeof appointmentStatuses)[number]

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada",
  no_asistio: "No asistió",
}

export interface Professional {
  id: string
  name: string
  specialty: string
}

export interface Room {
  id: string
  name: string
}

export const appointmentSchema = z
  .object({
    patientId: z.string().min(1, "Selecciona un paciente"),
    professionalId: z.string().min(1, "Selecciona un profesional"),
    treatmentId: z.string().optional(),
    roomId: z.string().optional(),
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
  roomId?: string
  start: string
  end: string
  status: AppointmentStatus
  notes?: string
  createdAt: string
}

/** Bloqueo puntual de agenda (vacaciones, almuerzo, mantenimiento de consultorio, etc.). No recurrente. */
export const scheduleBlockSchema = z
  .object({
    professionalId: z.string().optional(),
    roomId: z.string().optional(),
    date: z.string().min(1, "La fecha es obligatoria"),
    startTime: z.string().min(1, "La hora de inicio es obligatoria"),
    endTime: z.string().min(1, "La hora de fin es obligatoria"),
    reason: z.string().min(3, "Describe el motivo del bloqueo"),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "La hora de fin debe ser posterior a la de inicio",
    path: ["endTime"],
  })
  .refine((data) => Boolean(data.professionalId) || Boolean(data.roomId), {
    message: "Selecciona un profesional o un consultorio",
    path: ["roomId"],
  })

export type ScheduleBlockFormValues = z.infer<typeof scheduleBlockSchema>

export interface ScheduleBlock {
  id: string
  professionalId?: string
  roomId?: string
  start: string
  end: string
  reason: string
  createdAt: string
}
