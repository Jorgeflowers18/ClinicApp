import type { PageQuery, Paginated } from "@/shared/types/common"

import type {
  NotificationChannel,
  NotificationLog,
  NotificationStatus,
  NotificationTemplate,
  NotificationTemplateFormValues,
  NotificationType,
} from "../types/notification.types"

/** Filtros del historial; los aplica el servidor. `search`: nombre o cédula del paciente. */
export interface NotificationLogQuery extends PageQuery {
  /** Días de la clínica, `YYYY-MM-DD`, inclusivos. */
  dateFrom?: string
  dateTo?: string
  channel?: NotificationChannel
  status?: NotificationStatus
  type?: NotificationType
  /** Solo esa notificación (el enlace de una alerta de envío fallido). */
  id?: string
}

/** Indicadores de todo el historial (`GET /notifications/summary`), sin leerlo completo. */
export interface NotificationSummary {
  total: number
  sent: number
  failed: number
}

/** Lo del día para el centro de alertas, en una sola petición (`GET /alerts`). */
export interface AlertsSnapshot {
  date: string
  appointmentsToday: Array<{ id: string; start: string; end: string; status: string; patientId: string; patientName: string; professionalId: string; professionalName: string }>
  birthdaysToday: Array<{ patientId: string; patientName: string; birthDate: string }>
  /** Vacío para el médico. */
  criticalItems: Array<{ itemId: string; name: string; stock: number; minStock: number; unit: string }>
  /** Últimos 7 días. Vacío para el médico. */
  failedDeliveries: Array<{ id: string; patientId: string; patientName: string; appointmentId: string | null; channel: string; type: string; sentAt: string | null }>
}

/**
 * Notificaciones a pacientes. `notifications.http.ts` lo cumple con la API.
 *
 * Las notificaciones de las citas las crea el servidor (al crear o cancelar la cita, y los recordatorios):
 * el frontend no las registra.
 */
export interface NotificationsApi {
  list(query: NotificationLogQuery, signal?: AbortSignal): Promise<Paginated<NotificationLog>>
  listByAppointment(appointmentId: string, signal?: AbortSignal): Promise<NotificationLog[]>
  getSummary(signal?: AbortSignal): Promise<NotificationSummary>
  getTemplate(signal?: AbortSignal): Promise<NotificationTemplate>
  updateTemplate(values: NotificationTemplateFormValues): Promise<NotificationTemplate>
  getAlerts(signal?: AbortSignal): Promise<AlertsSnapshot>
}
