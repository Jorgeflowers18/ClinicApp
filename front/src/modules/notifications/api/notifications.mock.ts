import { mockDelay, nextId, paginate } from "@/shared/lib/mock"
import { mockPatients } from "@/modules/patients/api/patients.mock-data"

import type { NotificationsApi } from "./notifications.contract"
import { mockNotifications, mockNotificationTemplate } from "./notifications.mock-data"
import type { NotificationLog, NotificationType } from "../types/notification.types"

/** El servidor filtra esto con la tabla de pacientes; aquí se simula igual. */
function matchesPatientSearch(patientId: string, search: string) {
  const patient = mockPatients.find((item) => item.id === patientId)
  if (!patient) return false
  return [patient.firstName, patient.lastName, patient.documentId].join(" ").toLowerCase().includes(search)
}

/**
 * Lo que con la API hace el servidor al crear o cancelar una cita. Solo lo usa `appointments.mock.ts`.
 * Respeta `Patient.notificationsEnabled`. No genera `recordatorio_cita`: ese tipo necesita un proceso que
 * dispare por tiempo (24 h antes de la cita); sigue existiendo solo como dato semilla.
 */
export async function logMockAppointmentEvent(input: { patientId: string; appointmentId: string; type: NotificationType }): Promise<NotificationLog | null> {
  await mockDelay(150)
  const patient = mockPatients.find((item) => item.id === input.patientId)
  if (!patient || !patient.notificationsEnabled) return null
  const log: NotificationLog = {
    id: nextId("ntf"),
    patientId: input.patientId,
    appointmentId: input.appointmentId,
    type: input.type,
    channel: "email",
    status: "enviada",
    sentAt: new Date().toISOString(),
  }
  mockNotifications.unshift(log)
  return log
}

export const mockNotificationsApi: NotificationsApi = {
  async list(query) {
    await mockDelay()
    const search = query.search?.trim().toLowerCase()
    let filtered = mockNotifications
    if (search) filtered = filtered.filter((log) => matchesPatientSearch(log.patientId, search))
    if (query.dateFrom) filtered = filtered.filter((log) => log.sentAt >= query.dateFrom!)
    if (query.dateTo) {
      const upperBound = `${query.dateTo}T23:59:59.999Z`
      filtered = filtered.filter((log) => log.sentAt <= upperBound)
    }
    return paginate([...filtered].sort((a, b) => b.sentAt.localeCompare(a.sentAt)), query)
  },
  async listByAppointment(appointmentId) {
    await mockDelay(150)
    return mockNotifications.filter((log) => log.appointmentId === appointmentId)
  },
  async getTemplate() {
    await mockDelay(200)
    return mockNotificationTemplate
  },
  async updateTemplate(values) {
    await mockDelay()
    mockNotificationTemplate.message = values.message
    mockNotificationTemplate.updatedAt = new Date().toISOString()
    return mockNotificationTemplate
  },
}
