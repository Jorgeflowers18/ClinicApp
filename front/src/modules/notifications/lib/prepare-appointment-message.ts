import { appointmentsApi } from "@/modules/appointments/api/appointments.api"
import { patientsApi } from "@/modules/patients/api/patients.api"
import { readSavedInstitutionName } from "@/modules/institution/types/institution.types"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { ApiError } from "@/shared/types/common"
import { notificationsApi } from "../api/notifications.api"
import { hasActiveAppointmentStatus, resolveAppointmentMessage } from "./message-template"
import type { NotificationType } from "../types/notification.types"

/** Read-only preparation, not a sender or scheduler. Fetch current relations at every call.
 * Existing sent logs are never passed through this function or rewritten.
 */
export async function prepareAppointmentMessage(appointmentId: string, type: NotificationType = "recordatorio_cita") {
  const actor = useAuthStore.getState().user
  if (!actor || !["admin", "recepcion"].includes(actor.role)) throw new ApiError("No tienes permiso para gestionar Mensajería.", 403)
  if (!appointmentId) throw new ApiError("Selecciona una cita para generar el recordatorio.", 422, [{ field: "appointmentId", message: "Selecciona una cita para generar el recordatorio." }])
  const [appointment, template, professionals] = await Promise.all([
    appointmentsApi.get(appointmentId), notificationsApi.getTemplate(), appointmentsApi.listProfessionals(),
  ])
  const patient = await patientsApi.get(appointment.patientId)
  const current = useAuthStore.getState().user
  if (current?.id !== actor.id || !["admin", "recepcion"].includes(current.role)) throw new ApiError("La sesión cambió. Vuelve a seleccionar la cita.", 403)
  // These are the same active states used by the existing appointment notifications.
  // Timing and dispatch remain owned by the existing backend, not by this resolver.
  if (type === "recordatorio_cita" && !hasActiveAppointmentStatus(appointment)) throw new ApiError("Esta cita ya no está activa para un recordatorio. Revisa su estado en el calendario.", 422, [{ field: "appointmentId", message: "Esta cita ya no está activa para un recordatorio." }])
  if (!patient.notificationsEnabled) throw new ApiError("El paciente tiene las notificaciones deshabilitadas.", 422, [{ field: "patientId", message: "El paciente tiene las notificaciones deshabilitadas." }])
  const result = resolveAppointmentMessage(template.message, {
    institutionName: readSavedInstitutionName(), appointment, patient,
    professional: professionals.find(item => item.id === appointment.professionalId),
  })
  if (!result.complete) throw new ApiError(result.issues[0].message, 422, result.issues)
  return { message: result.message, appointmentId: appointment.id, patientId: patient.id, professionalId: appointment.professionalId }
}
