import type { ZodType } from "zod"

import type { ApiFieldError } from "@/shared/types/common"
import type { Professional } from "@/modules/appointments/types/appointment.types"

import { medicalAlertLabels, type Allergy, type MedicalAlertKey } from "../types/background.types"
import {
  recordFormSchema,
  type ChartSnapshot,
  type ClinicalEncounter,
  type ClinicalRecord,
  type PerformedTreatment,
  type RecordFormValues,
} from "../types/clinical-history.types"

export { today } from "./today"

export function compareEncounters(a: Pick<ClinicalEncounter, "date" | "createdAt">, b: Pick<ClinicalEncounter, "date" | "createdAt">) {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
}

export function latestEncounter(encounters: readonly ClinicalEncounter[] | undefined) {
  return [...(encounters ?? [])].sort(compareEncounters).at(-1)
}

export function countPerformedTreatments(encounters: readonly ClinicalEncounter[] | undefined) {
  return (encounters ?? []).reduce((total, encounter) => total + encounter.performedTreatments.length, 0)
}

/** Suma de costos; un costo a medio escribir (vacío) cuenta como cero hasta que se corrija. */
export function sumCosts(items: readonly Pick<PerformedTreatment, "cost">[]) {
  return items.reduce((sum, item) => sum + (Number.isFinite(item.cost) ? item.cost : 0), 0)
}

export function pickRecordValues(record: ClinicalRecord): RecordFormValues {
  return {
    chart: record.chart,
    medicalBackground: record.medicalBackground,
    allergiesAndMedication: record.allergiesAndMedication,
    habits: record.habits,
    dentalBackground: record.dentalBackground,
    periodontalBackground: record.periodontalBackground,
    plan: record.plan,
    dataConsent: record.dataConsent,
    truthDeclaration: record.truthDeclaration,
    attachments: record.attachments,
    examRequests: record.examRequests,
  }
}

export const recordSectionLabels: Record<keyof RecordFormValues, string> = {
  chart: "Odontograma y periodontograma",
  medicalBackground: "Antecedentes médicos",
  allergiesAndMedication: "Alergias, medicamentos y alertas",
  habits: "Hábitos y factores de riesgo",
  dentalBackground: "Antecedentes odontológicos",
  periodontalBackground: "Antecedentes periodontales",
  plan: "Plan de tratamiento",
  dataConsent: "Consentimiento de datos",
  truthDeclaration: "Declaración de veracidad",
  attachments: "Fotos y documentos",
  examRequests: "Exámenes solicitados",
}

const recordSections = Object.keys(recordSectionLabels) as (keyof RecordFormValues)[]

/** Secciones de la historia que difieren del último estado guardado. */
export function changedSections<T extends object>(saved: T, current: T, sections: readonly (keyof T)[]) {
  return sections.filter((section) => JSON.stringify(saved[section]) !== JSON.stringify(current[section]))
}

export const changedRecordSections = (saved: RecordFormValues, current: RecordFormValues) =>
  changedSections(saved, current, recordSections)

/** Alertas médicas y alergias registradas, en una lista corta para mostrarlas destacadas. */
export function medicalAlertsOf(source: { alerts: readonly MedicalAlertKey[]; allergies: readonly Allergy[] }) {
  return [
    ...source.alerts.map((key) => medicalAlertLabels[key]),
    ...source.allergies.map((allergy) => {
      const substance = allergy.substance.trim()
      const details = [substance ? allergy.reaction.trim() : "", allergy.manifestation.trim()].filter(Boolean)
      return `Alergia: ${substance || allergy.reaction.trim()}${details.length ? ` (${details.join(", ")})` : ""}`
    }),
  ]
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
