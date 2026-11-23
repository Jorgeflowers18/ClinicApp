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
  /** Registro profesional (por ejemplo, el del MSP / Senescyt). Vacío si no se registró. */
  registrationNumber: string
  /** Un profesional inactivo no se ofrece en los selectores, pero sus citas siguen mostrando su nombre. */
  active: boolean
  /** La cuenta de usuario vinculada (para el profesional por defecto de una atención). */
  userId: string | null
}

export interface Room {
  id: string
  name: string
  active: boolean
}

/**
 * Lo que un selector ofrece: solo los activos, más el valor ya elegido aunque se haya desactivado (al editar
 * una cita de un profesional inactivo, el campo no queda vacío).
 */
export function selectable<T extends { id: string; active: boolean }>(items: T[] | undefined, currentId?: string | null): T[] {
  return (items ?? []).filter((item) => item.active || item.id === currentId)
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
  /** "Nombres Apellidos", lo trae la API. */
  patientName?: string
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

/** Variante del `Badge` para cada estado de cita (agenda e historia clínica). */
export const appointmentStatusVariants: Record<AppointmentStatus, "default" | "outline" | "destructive" | "secondary"> = {
  programada: "outline",
  confirmada: "default",
  completada: "secondary",
  cancelada: "destructive",
  no_asistio: "destructive",
}

/** Formulario de profesional (pantalla de administración). Las mismas reglas que `ProfessionalRequest` del back. */
export const professionalSchema = z.object({
  name: z.string().trim().min(3, "Mínimo 3 caracteres").max(120, "Máximo 120 caracteres"),
  specialty: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres"),
  registrationNumber: z.string().trim().max(40, "Máximo 40 caracteres"),
  active: z.boolean(),
})
export type ProfessionalFormValues = z.infer<typeof professionalSchema>

/** Lo que devuelve editar un profesional: además, cuántas citas futuras tiene (para avisar al desactivarlo). */
export interface ProfessionalUpdateResult extends Professional {
  futureAppointments: number
}

/** Formulario de consultorio. Las mismas reglas que `RoomRequest` del back. */
export const roomSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  active: z.boolean(),
})
export type RoomFormValues = z.infer<typeof roomSchema>
