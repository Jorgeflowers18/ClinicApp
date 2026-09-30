import type { ApiFieldError } from "@/shared/types/common"
import type { Professional } from "@/modules/appointments/types/appointment.types"

import {
  visitFormSchema,
  type ChartSnapshot,
  type DentalRecord,
  type DentalVisit,
  type VisitFormValues,
} from "../types/clinical-history.types"

/** Fecha local en formato YYYY-MM-DD (no UTC, para no adelantar el día en América). */
export function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function compareVisits(a: DentalVisit, b: DentalVisit) {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
}

export function findDraft(record: DentalRecord | undefined) {
  return record?.visits.find((visit) => visit.status === "borrador")
}

export function closedVisits(record: DentalRecord | undefined) {
  return (record?.visits ?? []).filter((visit) => visit.status === "cerrada").sort(compareVisits)
}

export function latestClosedVisit(record: DentalRecord | undefined) {
  return closedVisits(record).at(-1)
}

export function pickFormValues(visit: DentalVisit): VisitFormValues {
  return {
    date: visit.date,
    professionalId: visit.professionalId,
    appointmentId: visit.appointmentId,
    reason: visit.reason,
    diagnosis: visit.diagnosis,
    procedures: visit.procedures,
    evolution: visit.evolution,
    notes: visit.notes,
    nextVisit: visit.nextVisit,
    chart: visit.chart,
    plan: visit.plan,
    consents: visit.consents,
    attachments: visit.attachments,
  }
}

/** Mismas reglas que el formulario, reutilizadas como validación "del servidor" en el cierre. */
export function validateVisitForClose(visit: DentalVisit): ApiFieldError[] {
  const result = visitFormSchema.safeParse(pickFormValues(visit))
  if (result.success) return []
  return result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/** Busca el profesional cuyo nombre coincide (sin tildes ni mayúsculas). */
export function matchProfessionalByName(name: string | undefined, professionals: readonly Professional[]) {
  if (!name?.trim()) return undefined
  const target = normalizeName(name)
  return professionals.find((professional) => normalizeName(professional.name) === target)
}

export function resolveProfessionalName(
  visit: Pick<DentalVisit, "professionalId" | "legacyProfessionalName">,
  professionals: readonly Professional[] | undefined
) {
  const professional = professionals?.find((item) => item.id === visit.professionalId)
  return professional?.name ?? visit.legacyProfessionalName ?? "Profesional sin asignar"
}

/** Incrusta en el payload del odontograma los datos del caso (paciente, nacimiento, fecha del examen). */
export function withCaseData(
  chart: ChartSnapshot | null,
  data: { patientName: string; birthDate: string; date: string }
): ChartSnapshot | null {
  if (!chart) return null
  const current = chart.payload.case
  return {
    ...chart,
    payload: {
      ...chart.payload,
      case: {
        ...(current && typeof current === "object" ? current : {}),
        patientName: data.patientName,
        patientDob: data.birthDate,
        examDate: data.date,
      },
    },
  }
}
