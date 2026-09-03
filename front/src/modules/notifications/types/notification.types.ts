import { z } from "zod"

export const notificationChannels = ["email", "sms"] as const
export type NotificationChannel = (typeof notificationChannels)[number]

export const notificationChannelLabels: Record<NotificationChannel, string> = {
  email: "Correo",
  sms: "SMS",
}

export const notificationTypes = ["recordatorio_cita", "confirmacion_cita", "cancelacion_cita"] as const
export type NotificationType = (typeof notificationTypes)[number]

export const notificationTypeLabels: Record<NotificationType, string> = {
  recordatorio_cita: "Recordatorio de cita",
  confirmacion_cita: "Confirmación de cita",
  cancelacion_cita: "Cancelación de cita",
}

export const notificationStatuses = ["enviada", "fallida"] as const
export type NotificationStatus = (typeof notificationStatuses)[number]

export const notificationStatusLabels: Record<NotificationStatus, string> = {
  enviada: "Enviada",
  fallida: "Fallida",
}

export interface NotificationLog {
  id: string
  patientId: string
  appointmentId?: string
  type: NotificationType
  channel: NotificationChannel
  status: NotificationStatus
  sentAt: string
}

/** Variables que el usuario puede insertar en la plantilla; se reemplazan por el valor real al enviar la notificación. */
export interface NotificationVariable {
  token: string
  label: string
  example: string
}

export const notificationVariables: NotificationVariable[] = [
  { token: "[nombre del cliente]", label: "Nombre del cliente", example: "María González" },
  { token: "[nombre de la clínica]", label: "Nombre de la clínica", example: "Grupo Odontológico Sonrisas" },
  { token: "[fecha de la cita]", label: "Fecha de la cita", example: "12 de septiembre" },
  { token: "[hora de la cita]", label: "Hora de la cita", example: "10:00 am" },
  { token: "[profesional]", label: "Profesional", example: "Dra. Carla Ríos" },
]

export const notificationTemplateSchema = z.object({
  message: z.string().min(10, "El mensaje debe tener al menos 10 caracteres"),
})

export type NotificationTemplateFormValues = z.infer<typeof notificationTemplateSchema>

export interface NotificationTemplate extends NotificationTemplateFormValues {
  id: string
  updatedAt: string
}
