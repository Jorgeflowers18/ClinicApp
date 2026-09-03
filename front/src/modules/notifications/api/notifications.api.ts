import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { mockDelay, paginate } from "@/shared/lib/mock"
import type { PageQuery, Paginated } from "@/shared/types/common"
import { mockPatients } from "@/modules/patients/api/patients.mock-data"

import { mockNotifications, mockNotificationTemplate } from "./notifications.mock-data"
import type {
  NotificationLog,
  NotificationTemplate,
  NotificationTemplateFormValues,
} from "../types/notification.types"

export interface NotificationLogQuery extends PageQuery {
  dateFrom?: string
  dateTo?: string
}

/** El backend real filtra esto con un JOIN a la tabla de pacientes; aquí se simula igual. */
function matchesPatientSearch(patientId: string, search: string) {
  const patient = mockPatients.find((item) => item.id === patientId)
  if (!patient) return false
  return [patient.firstName, patient.lastName, patient.documentId]
    .join(" ")
    .toLowerCase()
    .includes(search)
}

async function listMock(query: NotificationLogQuery): Promise<Paginated<NotificationLog>> {
  await mockDelay()
  const search = query.search?.trim().toLowerCase()

  let filtered = mockNotifications
  if (search) {
    filtered = filtered.filter((log) => matchesPatientSearch(log.patientId, search))
  }
  if (query.dateFrom) {
    filtered = filtered.filter((log) => log.sentAt >= query.dateFrom!)
  }
  if (query.dateTo) {
    const upperBound = `${query.dateTo}T23:59:59.999Z`
    filtered = filtered.filter((log) => log.sentAt <= upperBound)
  }

  return paginate([...filtered].sort((a, b) => b.sentAt.localeCompare(a.sentAt)), query)
}

async function listByAppointmentMock(appointmentId: string): Promise<NotificationLog[]> {
  await mockDelay(150)
  return mockNotifications.filter((log) => log.appointmentId === appointmentId)
}

async function getTemplateMock(): Promise<NotificationTemplate> {
  await mockDelay(200)
  return mockNotificationTemplate
}

async function updateTemplateMock(values: NotificationTemplateFormValues): Promise<NotificationTemplate> {
  await mockDelay()
  mockNotificationTemplate.message = values.message
  mockNotificationTemplate.updatedAt = new Date().toISOString()
  return mockNotificationTemplate
}

// TODO: conectar a endpoint real -> GET /notifications (API .NET), query params page/pageSize/search/dateFrom/dateTo
async function listReal(query: NotificationLogQuery): Promise<Paginated<NotificationLog>> {
  const { data } = await http.get<Paginated<NotificationLog>>("/notifications", { params: query })
  return data
}

// TODO: conectar a endpoint real -> GET /notifications?appointmentId=:id
async function listByAppointmentReal(appointmentId: string): Promise<NotificationLog[]> {
  const { data } = await http.get<NotificationLog[]>("/notifications", { params: { appointmentId } })
  return data
}

// TODO: conectar a endpoint real -> GET /notifications/template
async function getTemplateReal(): Promise<NotificationTemplate> {
  const { data } = await http.get<NotificationTemplate>("/notifications/template")
  return data
}

// TODO: conectar a endpoint real -> PUT /notifications/template
async function updateTemplateReal(values: NotificationTemplateFormValues): Promise<NotificationTemplate> {
  const { data } = await http.put<NotificationTemplate>("/notifications/template", values)
  return data
}

export const notificationsApi = {
  list: env.useMockApi ? listMock : listReal,
  listByAppointment: env.useMockApi ? listByAppointmentMock : listByAppointmentReal,
  getTemplate: env.useMockApi ? getTemplateMock : getTemplateReal,
  updateTemplate: env.useMockApi ? updateTemplateMock : updateTemplateReal,
}
