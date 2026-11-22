import type { components } from "@/shared/api/schema"
import { apiGet, apiPut } from "@/shared/lib/http"
import type { Paginated } from "@/shared/types/common"

import type { AlertsSnapshot, NotificationsApi } from "./notifications.contract"
import type { NotificationLog, NotificationTemplate } from "../types/notification.types"

/**
 * `GET /notifications` responde con `IActionResult`, así que el OpenAPI no trae su forma: se declara aquí
 * (`NotificationLogDto` del back). Pendiente del back: tiparla con `ProducesResponseType`.
 */
interface NotificationLogDto {
  id: string
  patientId: string
  patientName: string
  appointmentId: string | null
  type: string
  channel: string
  status: string
  sentAt: string | null
  /** El texto enviado, ya armado con las variables. */
  message: string
}

const toLog = (dto: NotificationLogDto): NotificationLog => ({
  id: dto.id,
  patientId: dto.patientId,
  patientName: dto.patientName,
  appointmentId: dto.appointmentId ?? undefined,
  type: dto.type as NotificationLog["type"],
  channel: dto.channel as NotificationLog["channel"],
  status: dto.status as NotificationLog["status"],
  // Las pendientes no salen en la API: toda notificación listada tiene fecha de envío.
  sentAt: dto.sentAt ?? "",
  message: dto.message,
})

export const httpNotificationsApi: NotificationsApi = {
  async list(query, signal) {
    const page = await apiGet<Paginated<NotificationLogDto>>("/notifications", { params: query, signal })
    return { ...page, items: page.items.map(toLog) }
  },
  async listByAppointment(appointmentId, signal) {
    return (await apiGet<NotificationLogDto[]>("/notifications", { params: { appointmentId }, signal })).map(toLog)
  },
  async getTemplate(signal) {
    return apiGet<components["schemas"]["NotificationTemplateDto"]>("/notifications/template", { signal }) as Promise<NotificationTemplate>
  },
  async updateTemplate(values) {
    return apiPut<components["schemas"]["NotificationTemplateDto"]>("/notifications/template", values) as Promise<NotificationTemplate>
  },
  async getAlerts(signal) {
    return apiGet<components["schemas"]["AlertsDto"]>("/alerts", { signal }) as Promise<AlertsSnapshot>
  },
}
