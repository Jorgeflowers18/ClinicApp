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
  specialty?: string | null
  treatmentName?: string | null
  roomName?: string | null
  siteName?: string | null
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
const aliases:Record<string,string>={"{nombre_paciente}":"[nombre del cliente]","{nombre_institucion}":"[nombre de la clínica]","{fecha_cita}":"[fecha de la cita]","{hora_cita}":"[hora de la cita]","{profesional}":"[profesional]"}
for(const [token,label] of Object.entries({"{especialidad}":"Especialidad","{tratamiento}":"Tratamiento","{consultorio}":"Consultorio","{sede}":"Sede"}))missing[token]={field:"message",message:`${label}: no hay un dato vinculado verificable en esta cita.`,preview:`${label} no disponible`}

/** Single-pass, literal substitution. Values cannot introduce another template substitution. */
function resolve(message: string, values: Record<string, string | null>): ResolvedMessage {
  const issues: MessageIssue[] = []
  const resolved = message.replace(/\[[^[\]\r\n]+\]|\{[^{}\r\n]+\}/g, original => {
    const token=aliases[original]??original
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
    "{especialidad}":professional?context.specialty??null:null,
    "{tratamiento}":context.treatmentName??null,
    "{consultorio}":context.roomName??null,
    "{sede}":context.siteName??null,
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
    variable.token === "[nombre de la clínica]" || variable.token === "{nombre_institucion}" ? institutionName : variable.example])))
}
export function whatsappUrl(phone:string|undefined,message:string){let digits=(phone??"").replace(/\D/g,"");if(/^0\d{9}$/.test(digits))digits="593"+digits.slice(1);if(!/^[1-9]\d{9,14}$/.test(digits))return null;return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
