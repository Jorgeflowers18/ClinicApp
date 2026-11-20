import type { Appointment, Professional } from "@/modules/appointments/types/appointment.types"
import type { Patient } from "@/modules/patients/types/patient.types"
import { formatDateTime } from "@/shared/lib/date"
import { notificationVariables } from "../types/notification.types"

export interface MessageIssue { field: "appointmentId" | "institutionName" | "patientId" | "professionalId" | "start" | "message"; message: string }
export interface AppointmentMessageContext {
  institutionName: string | null
  appointment?: Appointment | null
  patient?: Pick<Patient, "id" | "firstName" | "lastName"> | null
  professional?: Pick<Professional, "id" | "name"> | null
}
export interface ResolvedMessage { message: string; issues: MessageIssue[]; complete: boolean }
/** Existing active notification states; this deliberately does not decide dispatch timing. */
export const hasActiveAppointmentStatus = (appointment: Pick<Appointment, "status">) => ["programada", "confirmada"].includes(appointment.status)
const missing: Record<string, MessageIssue & { preview: string }> = {
  "[nombre del cliente]": { field: "patientId", message: "No se pudo identificar al paciente vinculado a esta cita.", preview: "Paciente no disponible" },
  "[nombre de la clínica]": { field: "institutionName", message: "Configura el nombre de la institución en Perfil institucional.", preview: "Nombre institucional pendiente de configuración" },
  "[fecha de la cita]": { field: "start", message: "Esta cita no tiene una fecha de inicio válida.", preview: "Fecha de cita no disponible" },
  "[hora de la cita]": { field: "start", message: "Esta cita no tiene una hora de inicio válida.", preview: "Hora de cita no disponible" },
  "[profesional]": { field: "professionalId", message: "Esta cita no tiene un profesional asignado disponible.", preview: "Profesional pendiente de asignación" },
}

/** Single-pass, literal substitution. Values cannot introduce another template substitution. */
function resolve(message: string, values: Record<string, string | null>): ResolvedMessage {
  const issues: MessageIssue[] = []
  const resolved = message.replace(/\[[^[\]\r\n]+\]/g, token => {
    if (!Object.hasOwn(missing, token)) {
      issues.push({ field: "message", message: `La variable ${token} no está disponible. Usa las variables del editor.` })
      return `Variable no reconocida: ${token.slice(1, -1)}`
    }
    if (values[token]?.trim()) return values[token]!
    const { field, message, preview } = missing[token]
    issues.push({ field, message })
    return preview
  })
  const unique = issues.filter((issue, index) => issues.findIndex(other => other.field === issue.field && other.message === issue.message) === index)
  return { message: resolved, issues: unique, complete: unique.length === 0 }
}

export function appointmentDateTime(start: string | undefined) {
  if (!start || !Number.isFinite(new Date(start).getTime())) return null
  return {
    date: formatDateTime(start, { day: "numeric", month: "long", year: "numeric", timeZone: "America/Guayaquil" }),
    time: new Date(start).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" }),
  }
}

export function resolveAppointmentMessage(message: string, context: AppointmentMessageContext): ResolvedMessage {
  const { appointment } = context
  const patient = appointment && context.patient?.id === appointment.patientId ? context.patient : null
  const professional = appointment && context.professional?.id === appointment.professionalId ? context.professional : null
  const date = appointmentDateTime(appointment?.start)
  const result = resolve(message, {
    "[nombre del cliente]": patient ? `${patient.firstName} ${patient.lastName}`.trim() : null,
    "[nombre de la clínica]": context.institutionName,
    "[fecha de la cita]": date?.date ?? null,
    "[hora de la cita]": date?.time ?? null,
    "[profesional]": professional?.name ?? null,
  })
  if (!appointment) {
    result.issues.unshift({ field: "appointmentId", message: "Selecciona una cita para generar el recordatorio." })
    result.complete = false
  }
  return result
}

/** Only this explicitly-labelled preview is allowed to use sample patient/appointment data. */
export function resolveExampleMessage(message: string, institutionName: string | null): ResolvedMessage {
  return resolve(message, Object.fromEntries(notificationVariables.map(variable => [variable.token,
    variable.token === "[nombre de la clínica]" ? institutionName : variable.example])))
}
