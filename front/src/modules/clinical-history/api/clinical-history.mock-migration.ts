// MOCK-ONLY: eliminar al conectar el backend (ver arquitectura-frontend.md § Código solo-mock).
//
// Convierte lo que haya en IndexedDB al modelo actual de `DentalVisit`. Soporta el formato de la
// primera versión del módulo (profesional en texto libre, contenedor `draft`, `savedAt`) y
// registros que mezclan visitas antiguas y nuevas. Se aplica al leer: nada se reescribe hasta que
// el usuario guarda, así que los datos originales nunca se pierden.
import { mockProfessionals } from "@/modules/appointments/api/appointments.mock-data"

import { compareVisits, matchProfessionalByName } from "../lib/visit"
import {
  attachmentKinds,
  consentStatuses,
  planItemStatuses,
  visitStatuses,
  type ChartSnapshot,
  type DentalAttachment,
  type DentalConsent,
  type DentalRecord,
  type DentalVisit,
  type PlanItem,
} from "../types/clinical-history.types"

export interface StoredRecord {
  version: 2
  patientId: string
  visits: DentalVisit[]
}

type Raw = Record<string, unknown>

const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const text = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback)
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const nullableText = (value: unknown) => (typeof value === "string" && value ? value : null)

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback
}

function normalizePlanItem(raw: unknown): PlanItem | null {
  if (!isObject(raw)) return null
  const sessions = Number(raw.sessions)
  return {
    id: text(raw.id) || crypto.randomUUID(),
    treatmentId: nullableText(raw.treatmentId),
    description: text(raw.description),
    tooth: text(raw.tooth),
    sessions: Number.isInteger(sessions) && sessions > 0 ? sessions : 1,
    status: oneOf(raw.status, planItemStatuses, "pendiente"),
    assignmentId: nullableText(raw.assignmentId),
  }
}

function normalizeConsent(raw: unknown): DentalConsent | null {
  if (!isObject(raw)) return null
  return {
    id: text(raw.id) || crypto.randomUUID(),
    procedure: text(raw.procedure),
    information: text(raw.information),
    status: oneOf(raw.status, consentStatuses, "pendiente"),
    signer: text(raw.signer),
    date: text(raw.date),
  }
}

function normalizeAttachment(raw: unknown): DentalAttachment | null {
  if (!isObject(raw) || !text(raw.id)) return null
  return {
    id: text(raw.id),
    name: text(raw.name, "archivo"),
    kind: oneOf(raw.kind, attachmentKinds, "documento"),
    mime: text(raw.mime),
    size: Number(raw.size) || 0,
    createdAt: text(raw.createdAt, new Date(0).toISOString()),
  }
}

export function normalizeVisit(raw: unknown, patientId: string): DentalVisit | null {
  if (!isObject(raw) || !text(raw.id)) return null

  const date = text(raw.date)
  const base = {
    id: text(raw.id),
    patientId,
    date,
    reason: text(raw.reason),
    diagnosis: text(raw.diagnosis),
    procedures: text(raw.procedures),
    evolution: text(raw.evolution),
    notes: text(raw.notes),
    nextVisit: text(raw.nextVisit),
    chart: isObject(raw.chart) ? (raw.chart as unknown as ChartSnapshot) : null,
    plan: list(raw.plan).map(normalizePlanItem).filter((item): item is PlanItem => item !== null),
    consents: list(raw.consents).map(normalizeConsent).filter((item): item is DentalConsent => item !== null),
    attachments: list(raw.attachments).map(normalizeAttachment).filter((item): item is DentalAttachment => item !== null),
  }

  // Formato de la primera versión: sin `status`, con `savedAt` y el profesional en texto libre.
  if (!("status" in raw)) {
    const savedAt = nullableText(raw.savedAt)
    const legacyName = text(raw.professional)
    const timestamp = savedAt ?? (date ? `${date}T12:00:00.000Z` : new Date().toISOString())
    return {
      ...base,
      status: savedAt ? "cerrada" : "borrador",
      revision: 0,
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
    status: oneOf(raw.status, visitStatuses, "borrador"),
    revision: Number.isInteger(raw.revision) ? (raw.revision as number) : 0,
    professionalId: text(raw.professionalId),
    legacyProfessionalName: nullableText(raw.legacyProfessionalName) ?? undefined,
    appointmentId: nullableText(raw.appointmentId),
    createdAt,
    updatedAt: text(raw.updatedAt, createdAt),
    closedAt: nullableText(raw.closedAt),
  }
}

export function normalizeStoredRecord(raw: unknown, patientId: string): DentalRecord {
  if (!isObject(raw)) return { patientId, visits: [] }
  const candidates = [...list(raw.visits), ...(isObject(raw.draft) ? [raw.draft] : [])]
  const byId = new Map<string, DentalVisit>()
  for (const candidate of candidates) {
    const visit = normalizeVisit(candidate, patientId)
    if (visit && !byId.has(visit.id)) byId.set(visit.id, visit)
  }
  return { patientId, visits: [...byId.values()].sort(compareVisits) }
}

export function toStoredRecord(record: DentalRecord): StoredRecord {
  return { version: 2, patientId: record.patientId, visits: record.visits }
}

export function referencedFileIds(record: DentalRecord) {
  return new Set(record.visits.flatMap((visit) => visit.attachments.map((file) => file.id)))
}
