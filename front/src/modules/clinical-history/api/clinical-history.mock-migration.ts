// MOCK-ONLY: eliminar al conectar el backend (ver arquitectura-frontend.md § Código solo-mock).
//
// Convierte lo que haya en IndexedDB al modelo actual (historia editable + atenciones). Soporta:
// - versión 3: el modelo actual; las secciones agregadas después (antecedentes, declaración,
//   exámenes solicitados, evaluación de la atención…) se completan al leer, sin cambiar la versión;
// - versión 2: visitas con estado borrador / cerrada;
// - primera versión del módulo: profesional en texto libre, contenedor `draft`, `savedAt`.
// Se aplica al leer: nada se reescribe hasta que el usuario guarda, así que los datos originales
// nunca se pierden.
import { createId } from "@/shared/lib/id"
import { mockProfessionals } from "@/modules/appointments/api/appointments.mock-data"
import { mockLegacyClinicalNotes } from "@/modules/patients/api/patients.mock-data"
import { mockTreatments } from "@/modules/treatments/api/treatments.mock-data"

import { diagnosesFromText, emptyEncounterValues } from "../lib/encounter"
import { compareEncounters, matchProfessionalByName } from "../lib/record"
import {
  emptyAllergiesAndMedication,
  emptyDentalBackground,
  emptyHabits,
  emptyMedicalBackground,
  emptyPeriodontalBackground,
  emptyTruthDeclaration,
  medicalAlertKeys,
  type Allergy,
  type AllergiesAndMedication,
  type MedicalBackground,
  type Medication,
} from "../types/background.types"
import { examKindKeys, type Diagnosis, type RequestedExam } from "../types/encounter-assessment.types"
import {
  attachmentKinds,
  dataConsentSigners,
  dataConsentStatuses,
  emptyDataConsent,
  examRequestStatuses,
  treatmentPhases,
  type AttachmentKind,
  type ChartSnapshot,
  type ClinicalEncounter,
  type ClinicalRecord,
  type DataConsent,
  type DentalAttachment,
  type EncounterNote,
  type ExamRequest,
  type PatientClinicalHistory,
  type PerformedTreatment,
  type ProposedTreatment,
} from "../types/clinical-history.types"

export interface StoredHistory {
  version: 3
  patientId: string
  record: ClinicalRecord
  encounters: ClinicalEncounter[]
}

type Raw = Record<string, unknown>

const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const text = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback)
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const nullableText = (value: unknown) => (typeof value === "string" && value ? value : null)
const chartOf = (value: unknown) => (isObject(value) ? (value as unknown as ChartSnapshot) : null)

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback
}

function compact<T>(items: (T | null)[]) {
  return items.filter((item): item is T => item !== null)
}

/**
 * Completa `raw` con la forma de `defaults`: conserva cada valor guardado del mismo tipo y usa el
 * valor por defecto en lo que falte. Los números opcionales (`null` por defecto) aceptan números.
 */
function withDefaults<T>(defaults: T, raw: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(raw) ? raw : defaults) as T
  if (isObject(defaults)) {
    const source = isObject(raw) ? raw : {}
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, withDefaults(value, source[key])])) as T
  }
  if (defaults === null) return (typeof raw === "number" && Number.isFinite(raw) ? raw : null) as T
  return (typeof raw === typeof defaults ? raw : defaults) as T
}

/** Lista de claves conocidas (descarta las que ya no existen). */
const keysIn = <K extends string>(value: unknown, options: readonly K[]) =>
  list(value).filter((item): item is K => options.includes(item as K))

// ---------------------------------------------------------------------------------------------
// Historia
// ---------------------------------------------------------------------------------------------

/** Tipos de archivo anteriores al ítem 12. */
const legacyAttachmentKinds: Record<string, AttachmentKind> = {
  radiografia: "radiografia_periapical",
  fotografia: "fotografias",
  documento: "otro",
}

function normalizeAttachment(raw: unknown): DentalAttachment | null {
  if (!isObject(raw) || !text(raw.id)) return null
  return {
    id: text(raw.id),
    name: text(raw.name, "archivo"),
    kind: legacyAttachmentKinds[text(raw.kind)] ?? oneOf(raw.kind, attachmentKinds, "otro"),
    mime: text(raw.mime),
    size: Number(raw.size) || 0,
    createdAt: text(raw.createdAt, new Date(0).toISOString()),
  }
}

function normalizeProposed(raw: unknown): ProposedTreatment | null {
  if (!isObject(raw)) return null
  return {
    id: text(raw.id) || createId(),
    treatmentId: nullableText(raw.treatmentId),
    description: text(raw.description),
    tooth: text(raw.tooth),
    phase: oneOf(raw.phase, ["", ...treatmentPhases] as const, ""),
    plannedDate: text(raw.plannedDate),
  }
}

function normalizePerformed(raw: unknown): PerformedTreatment | null {
  if (!isObject(raw)) return null
  const cost = Number(raw.cost)
  return {
    id: text(raw.id) || createId(),
    treatmentId: nullableText(raw.treatmentId),
    description: text(raw.description),
    tooth: text(raw.tooth),
    cost: Number.isFinite(cost) && cost >= 0 ? cost : 0,
    assignmentId: nullableText(raw.assignmentId),
  }
}

function normalizeDataConsent(raw: unknown): DataConsent {
  if (!isObject(raw)) return { ...emptyDataConsent }
  return {
    status: oneOf(raw.status, dataConsentStatuses, "pendiente"),
    signer: oneOf(raw.signer, dataConsentSigners, "paciente"),
    signerName: text(raw.signerName),
    signerDocumentId: text(raw.signerDocumentId),
    date: text(raw.date),
    attachmentId: nullableText(raw.attachmentId),
  }
}

function normalizeAllergy(raw: unknown): Allergy | null {
  if (!isObject(raw)) return null
  return { ...withDefaults({ id: "", reaction: "", substance: "", manifestation: "" }, raw), id: text(raw.id) || createId() }
}

function normalizeMedication(raw: unknown): Medication | null {
  if (!isObject(raw)) return null
  return { ...withDefaults({ id: "", name: "", dose: "", indication: "" }, raw), id: text(raw.id) || createId() }
}

function normalizeAllergiesAndMedication(raw: unknown): AllergiesAndMedication {
  const source = isObject(raw) ? raw : {}
  return {
    allergies: compact(list(source.allergies).map(normalizeAllergy)),
    medications: compact(list(source.medications).map(normalizeMedication)),
    alerts: keysIn(source.alerts, medicalAlertKeys),
  }
}

function normalizeExamRequest(raw: unknown): ExamRequest | null {
  if (!isObject(raw) || !text(raw.id)) return null
  return {
    id: text(raw.id),
    kind: oneOf(raw.kind, examKindKeys, "laboratorio"),
    detail: text(raw.detail),
    status: oneOf(raw.status, examRequestStatuses, "pendiente"),
    encounterId: text(raw.encounterId),
    requestedAt: text(raw.requestedAt),
    attachmentId: nullableText(raw.attachmentId),
    receivedAt: nullableText(raw.receivedAt),
  }
}

const NO_DATA = /^(no registra|ninguna?|sin (alergias|registro)|-)\.?$/i
const DENIES = /^(sin|niega) antecedentes/i

/**
 * Los textos libres «Antecedentes médicos» y «Alergias» que tenían los pacientes de ejemplo pasan a
 * la historia: el antecedente queda en «Otro» (o en «Niega antecedentes relevantes») y la alergia,
 * como una fila de la lista.
 */
function legacyClinicalSections(patientId: string): Pick<ClinicalRecord, "medicalBackground" | "allergiesAndMedication"> {
  const medicalBackground: MedicalBackground = emptyMedicalBackground()
  const allergiesAndMedication = emptyAllergiesAndMedication()
  const legacy = mockLegacyClinicalNotes[patientId]
  const history = legacy?.medicalHistory.trim() ?? ""
  const allergies = legacy?.allergies.trim() ?? ""
  if (DENIES.test(history)) medicalBackground.denies = true
  else if (history && !NO_DATA.test(history)) medicalBackground.conditions.otro = { personal: true, family: false, detail: history }
  if (allergies && !NO_DATA.test(allergies)) {
    allergiesAndMedication.allergies.push({ id: `${patientId}_alergia_1`, reaction: allergies, substance: "", manifestation: "" })
  }
  return { medicalBackground, allergiesAndMedication }
}

/** Secciones agregadas a la historia después de la versión 3; las que no estén guardadas se completan. */
function clinicalSections(raw: Raw, patientId: string) {
  const legacy = !("medicalBackground" in raw) && !("allergiesAndMedication" in raw) ? legacyClinicalSections(patientId) : null
  return {
    medicalBackground: legacy?.medicalBackground ?? withDefaults(emptyMedicalBackground(), raw.medicalBackground),
    allergiesAndMedication: legacy?.allergiesAndMedication ?? normalizeAllergiesAndMedication(raw.allergiesAndMedication),
    habits: withDefaults(emptyHabits(), raw.habits),
    dentalBackground: withDefaults(emptyDentalBackground(), raw.dentalBackground),
    periodontalBackground: withDefaults(emptyPeriodontalBackground(), raw.periodontalBackground),
    truthDeclaration: withDefaults(emptyTruthDeclaration(), raw.truthDeclaration),
    examRequests: compact(list(raw.examRequests).map(normalizeExamRequest)),
  }
}

export function emptyRecord(patientId: string, now = new Date().toISOString()): ClinicalRecord {
  return {
    patientId,
    revision: 0,
    chart: null,
    ...clinicalSections({}, patientId),
    plan: [],
    dataConsent: { ...emptyDataConsent },
    attachments: [],
    createdAt: now,
    updatedAt: now,
  }
}

function normalizeRecord(raw: unknown, patientId: string): ClinicalRecord {
  if (!isObject(raw)) return emptyRecord(patientId)
  const createdAt = text(raw.createdAt, new Date().toISOString())
  return {
    patientId,
    revision: Number.isInteger(raw.revision) ? (raw.revision as number) : 0,
    chart: chartOf(raw.chart),
    ...clinicalSections(raw, patientId),
    plan: compact(list(raw.plan).map(normalizeProposed)),
    dataConsent: normalizeDataConsent(raw.dataConsent),
    attachments: compact(list(raw.attachments).map(normalizeAttachment)),
    createdAt,
    updatedAt: text(raw.updatedAt, createdAt),
  }
}

// ---------------------------------------------------------------------------------------------
// Atenciones
// ---------------------------------------------------------------------------------------------

function normalizeNote(raw: unknown): EncounterNote | null {
  if (!isObject(raw) || !text(raw.id)) return null
  return {
    id: text(raw.id),
    text: text(raw.text),
    authorName: text(raw.authorName, "Usuario"),
    createdAt: text(raw.createdAt, new Date(0).toISOString()),
  }
}

function normalizeDiagnosis(raw: unknown): Diagnosis | null {
  if (!isObject(raw)) return null
  const diagnosis = withDefaults<Diagnosis>({ id: "", description: "", tooth: "", priority: "" }, raw)
  return { ...diagnosis, id: diagnosis.id || createId() }
}

function normalizeRequestedExam(raw: unknown): RequestedExam | null {
  if (!isObject(raw)) return null
  return {
    id: text(raw.id) || createId(),
    kind: oneOf(raw.kind, examKindKeys, "laboratorio"),
    detail: text(raw.detail),
  }
}

/** Las atenciones guardadas antes de la evaluación por pasos reciben sus campos vacíos («No evaluado»). */
function normalizeEncounter(raw: unknown, patientId: string): ClinicalEncounter | null {
  if (!isObject(raw) || !text(raw.id)) return null
  const id = text(raw.id)
  const defaults = emptyEncounterValues()
  return {
    ...withDefaults(defaults, raw),
    id,
    patientId,
    date: text(raw.date),
    professionalId: text(raw.professionalId),
    legacyProfessionalName: nullableText(raw.legacyProfessionalName) ?? undefined,
    appointmentId: nullableText(raw.appointmentId),
    diagnoses: Array.isArray(raw.diagnoses)
      ? compact(raw.diagnoses.map(normalizeDiagnosis))
      : diagnosesFromText(id, text(raw.diagnosis)),
    requestedExams: compact(list(raw.requestedExams).map(normalizeRequestedExam)),
    riskAssessment: keysIn(raw.riskAssessment, ["hemorragico", "infeccioso", "ambulatorio"] as const),
    performedTreatments: compact(list(raw.performedTreatments).map(normalizePerformed)),
    chartSnapshot: chartOf(raw.chartSnapshot),
    clinicalSnapshot: isObject(raw.clinicalSnapshot) ? normalizeAllergiesAndMedication(raw.clinicalSnapshot) : null,
    addenda: compact(list(raw.addenda).map(normalizeNote)),
    createdAt: text(raw.createdAt, new Date(0).toISOString()),
  }
}

// ---------------------------------------------------------------------------------------------
// Visitas (versiones 1 y 2) → historia + atenciones
// ---------------------------------------------------------------------------------------------

/** Visita de las versiones anteriores, ya normalizada. Solo existe para la conversión. */
interface LegacyVisit {
  id: string
  closed: boolean
  date: string
  professionalId: string
  legacyProfessionalName?: string
  appointmentId: string | null
  reason: string
  diagnosis: string
  procedures: string
  evolution: string
  notes: string
  nextVisit: string
  chart: ChartSnapshot | null
  plan: { id: string; treatmentId: string | null; description: string; tooth: string; status: string; assignmentId: string | null }[]
  attachments: DentalAttachment[]
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

function normalizeLegacyVisit(raw: unknown): LegacyVisit | null {
  if (!isObject(raw) || !text(raw.id)) return null
  const date = text(raw.date)
  const base = {
    id: text(raw.id),
    date,
    reason: text(raw.reason),
    diagnosis: text(raw.diagnosis),
    procedures: text(raw.procedures),
    evolution: text(raw.evolution),
    notes: text(raw.notes),
    nextVisit: text(raw.nextVisit),
    chart: chartOf(raw.chart),
    plan: list(raw.plan).flatMap((item) =>
      isObject(item)
        ? [
            {
              id: text(item.id) || createId(),
              treatmentId: nullableText(item.treatmentId),
              description: text(item.description),
              tooth: text(item.tooth),
              status: text(item.status, "pendiente"),
              assignmentId: nullableText(item.assignmentId),
            },
          ]
        : []
    ),
    attachments: compact(list(raw.attachments).map(normalizeAttachment)),
  }

  // Primera versión: sin `status`, con `savedAt` y el profesional en texto libre.
  if (!("status" in raw)) {
    const savedAt = nullableText(raw.savedAt)
    const legacyName = text(raw.professional)
    const timestamp = savedAt ?? (date ? `${date}T12:00:00.000Z` : new Date().toISOString())
    return {
      ...base,
      closed: Boolean(savedAt),
      professionalId: matchProfessionalByName(legacyName, mockProfessionals)?.id ?? "",
      legacyProfessionalName: legacyName || undefined,
      appointmentId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      closedAt: savedAt,
    }
  }

  const createdAt = text(raw.createdAt, new Date().toISOString())
  return {
    ...base,
    closed: raw.status === "cerrada",
    professionalId: text(raw.professionalId),
    legacyProfessionalName: nullableText(raw.legacyProfessionalName) ?? undefined,
    appointmentId: nullableText(raw.appointmentId),
    createdAt,
    updatedAt: text(raw.updatedAt, createdAt),
    closedAt: nullableText(raw.closedAt),
  }
}

const catalogPrice = (treatmentId: string | null) => mockTreatments.find((item) => item.id === treatmentId)?.price ?? 0

function visitToEncounter(visit: LegacyVisit, patientId: string): ClinicalEncounter {
  return {
    ...emptyEncounterValues(),
    id: visit.id,
    patientId,
    date: visit.date,
    professionalId: visit.professionalId,
    legacyProfessionalName: visit.legacyProfessionalName,
    appointmentId: visit.appointmentId,
    reason: visit.reason,
    diagnoses: diagnosesFromText(visit.id, visit.diagnosis),
    procedures: visit.procedures,
    evolution: visit.evolution,
    notes: visit.notes,
    nextVisit: visit.nextVisit,
    // Lo que ya tenía asignación en Tratamientos es lo que se hizo (o se inició) en esa visita.
    performedTreatments: visit.plan
      .filter((item) => item.assignmentId)
      .map((item) => ({
        id: item.id,
        treatmentId: item.treatmentId,
        description: item.description,
        tooth: item.tooth,
        cost: catalogPrice(item.treatmentId),
        assignmentId: item.assignmentId,
      })),
    chartSnapshot: visit.chart ? structuredClone(visit.chart) : null,
    clinicalSnapshot: null,
    addenda: [],
    createdAt: visit.closedAt ?? visit.createdAt,
  }
}

const hasClinicalData = (visit: LegacyVisit) => visit.reason.trim().length >= 3 && visit.diagnosis.trim().length >= 3

/**
 * - Historia: odontograma y propuestos de la visita más reciente (el borrador si existe); archivos de todas.
 * - Atenciones: cada visita cerrada, y el borrador solo si ya tiene motivo y diagnóstico. Se conservan los ids.
 * - Los consentimientos por procedimiento se descartan; el de datos queda pendiente.
 */
export function visitsToHistory(rawVisits: unknown[], patientId: string): PatientClinicalHistory {
  const byId = new Map<string, LegacyVisit>()
  for (const raw of rawVisits) {
    const visit = normalizeLegacyVisit(raw)
    if (visit && !byId.has(visit.id)) byId.set(visit.id, visit)
  }
  const visits = [...byId.values()].sort(compareEncounters)
  if (!visits.length) return { record: emptyRecord(patientId), encounters: [] }

  const draft = visits.find((visit) => !visit.closed)
  const current = draft ?? visits.at(-1)!
  const attachments = new Map(visits.flatMap((visit) => visit.attachments).map((file) => [file.id, file]))

  const record: ClinicalRecord = {
    ...emptyRecord(patientId),
    chart: current.chart ? structuredClone(current.chart) : null,
    plan: current.plan
      .filter((item) => item.status !== "cancelado" && !item.assignmentId)
      .map((item) => ({
        id: item.id,
        treatmentId: item.treatmentId,
        description: item.description,
        tooth: item.tooth,
        phase: "",
        plannedDate: "",
      })),
    attachments: [...attachments.values()],
    createdAt: visits[0].createdAt,
    updatedAt: visits.reduce((latest, visit) => (visit.updatedAt > latest ? visit.updatedAt : latest), visits[0].updatedAt),
  }
  const encounters = visits
    .filter((visit) => visit.closed || hasClinicalData(visit))
    .map((visit) => visitToEncounter(visit, patientId))
  return { record, encounters }
}

export function normalizeStoredHistory(raw: unknown, patientId: string): PatientClinicalHistory {
  if (!isObject(raw)) return { record: emptyRecord(patientId), encounters: [] }
  if (raw.version === 3) {
    const byId = new Map<string, ClinicalEncounter>()
    for (const candidate of list(raw.encounters)) {
      const encounter = normalizeEncounter(candidate, patientId)
      if (encounter && !byId.has(encounter.id)) byId.set(encounter.id, encounter)
    }
    return { record: normalizeRecord(raw.record, patientId), encounters: [...byId.values()].sort(compareEncounters) }
  }
  return visitsToHistory([...list(raw.visits), ...(isObject(raw.draft) ? [raw.draft] : [])], patientId)
}

export function toStoredHistory(history: PatientClinicalHistory): StoredHistory {
  return { version: 3, patientId: history.record.patientId, record: history.record, encounters: history.encounters }
}

export function referencedFileIds(history: PatientClinicalHistory) {
  return new Set(history.record.attachments.map((file) => file.id))
}
