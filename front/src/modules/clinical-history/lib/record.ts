import type { ZodType } from "zod"

import type { ApiFieldError } from "@/shared/types/common"
import type { Professional } from "@/modules/appointments/types/appointment.types"

import {
  recordFormSchema,
  type ChartSnapshot,
  type ClinicalEncounter,
  type ClinicalRecord,
  type RecordFormValues,
} from "../types/clinical-history.types"

export { today } from "../types/clinical-history.types"

export function compareEncounters(a: Pick<ClinicalEncounter, "date" | "createdAt">, b: Pick<ClinicalEncounter, "date" | "createdAt">) {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
}

export function latestEncounter(encounters: readonly ClinicalEncounter[] | undefined) {
  return [...(encounters ?? [])].sort(compareEncounters).at(-1)
}

export function countPerformedTreatments(encounters: readonly ClinicalEncounter[] | undefined) {
  return (encounters ?? []).reduce((total, encounter) => total + encounter.performedTreatments.length, 0)
}

export function pickRecordValues(record: ClinicalRecord): RecordFormValues {
  return {
    chart: record.chart,
    plan: record.plan,
    dataConsent: record.dataConsent,
    attachments: record.attachments,
  }
}

export const recordSectionLabels: Record<keyof RecordFormValues, string> = {
  chart: "Odontograma y periodontograma",
  plan: "Plan de tratamiento",
  dataConsent: "Consentimiento de datos",
  attachments: "Fotos y documentos",
}

const recordSections = Object.keys(recordSectionLabels) as (keyof RecordFormValues)[]

/** Secciones de la historia que difieren del último estado guardado. */
export function changedSections(saved: RecordFormValues, current: RecordFormValues) {
  return recordSections.filter((section) => JSON.stringify(saved[section]) !== JSON.stringify(current[section]))
}

/** Reglas del formulario reutilizadas como validación "del servidor" en el modo demostración. */
export function validateWith(schema: ZodType, values: unknown): ApiFieldError[] {
  const result = schema.safeParse(values)
  if (result.success) return []
  return result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))
}

export function validateRecord(record: ClinicalRecord) {
  return validateWith(recordFormSchema, pickRecordValues(record))
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
  encounter: Pick<ClinicalEncounter, "professionalId" | "legacyProfessionalName">,
  professionals: readonly Professional[] | undefined
) {
  const professional = professionals?.find((item) => item.id === encounter.professionalId)
  return professional?.name ?? encounter.legacyProfessionalName ?? "Profesional sin asignar"
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
