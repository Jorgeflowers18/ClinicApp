import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { createId } from "@/shared/lib/id"
import { mockDelay, paginate } from "@/shared/lib/mock"
import { ApiError, type Paginated } from "@/shared/types/common"
import { mockPatients } from "@/modules/patients/api/patients.mock-data"

import { allowedAttachmentTypes, diagnosisSummary, encounterFormSchema, maxAttachmentSize } from "../types/clinical-history.types"
import type {
  AddEncounterNoteInput,
  ClinicalEncounter,
  ClinicalRecord,
  CreateEncounterInput,
  DentalAttachment,
  EncounterListItem,
  EncounterListQuery,
  EncounterNote,
  PatientClinicalHistory,
  UploadAttachmentInput,
} from "../types/clinical-history.types"
import { compareEncounters, validateRecord, validateWith } from "../lib/record"
import { readAllHistories, readFile, readHistory, seedOnce, storeFile, writeHistory } from "./clinical-history.mock-storage"
import { seedHistoriesByPatient } from "./clinical-history.mock-data"

function toListItem(encounter: ClinicalEncounter): EncounterListItem {
  return {
    id: encounter.id,
    patientId: encounter.patientId,
    date: encounter.date,
    professionalId: encounter.professionalId,
    legacyProfessionalName: encounter.legacyProfessionalName,
    reason: encounter.reason,
    diagnoses: encounter.diagnoses,
    nextVisit: encounter.nextVisit,
  }
}

// MOCK-ONLY
const ensureSeeded = () => seedOnce(seedHistoriesByPatient)

// MOCK-ONLY
async function listEncountersMock(query: EncounterListQuery): Promise<Paginated<EncounterListItem>> {
  await mockDelay(250)
  await ensureSeeded()
  const search = query.search?.trim().toLowerCase()
  const encounters = (await readAllHistories())
    .flatMap((history) => history.encounters)
    .filter((encounter) => !query.patientId || encounter.patientId === query.patientId)
    .filter((encounter) => !query.professionalId || encounter.professionalId === query.professionalId)
    .filter((encounter) => {
      if (!search) return true
      const patient = mockPatients.find((item) => item.id === encounter.patientId)
      return [encounter.reason, diagnosisSummary(encounter), patient?.firstName, patient?.lastName, patient?.documentId]
        .join(" ")
        .toLowerCase()
        .includes(search)
    })
    .sort((a, b) => compareEncounters(b, a))
  return paginate(encounters.map(toListItem), query)
}

// MOCK-ONLY
async function getRecordMock(patientId: string): Promise<PatientClinicalHistory> {
  await mockDelay(200)
  await ensureSeeded()
  return readHistory(patientId)
}

// MOCK-ONLY
async function saveRecordMock(record: ClinicalRecord): Promise<ClinicalRecord> {
  await mockDelay(250)
  const fieldErrors = validateRecord(record)
  if (fieldErrors.length) throw new ApiError("Revisa los datos de la historia antes de guardar", 400, fieldErrors)
  let saved: ClinicalRecord | undefined
  await writeHistory(record.patientId, (history) => {
    if (history.record.revision !== record.revision) {
      throw new ApiError("Otra pestaña o usuario modificó esta historia. Recarga la historia antes de continuar.", 409)
    }
    saved = { ...record, revision: record.revision + 1, updatedAt: new Date().toISOString() }
    return { ...history, record: saved }
  })
  return saved as ClinicalRecord
}

// MOCK-ONLY
/** Idempotente por `input.id`: reintentar el guardado de la misma atención no la duplica. */
async function createEncounterMock(patientId: string, input: CreateEncounterInput): Promise<ClinicalEncounter> {
  await mockDelay(300)
  const fieldErrors = validateWith(encounterFormSchema, input)
  if (fieldErrors.length) throw new ApiError("Completa los datos obligatorios de la atención", 400, fieldErrors)
  let created: ClinicalEncounter | undefined
  await writeHistory(patientId, (history) => {
    const existing = history.encounters.find((encounter) => encounter.id === input.id)
    if (existing) {
      created = existing
      return history
    }
    if (input.appointmentId && history.encounters.some((encounter) => encounter.appointmentId === input.appointmentId)) {
      throw new ApiError("Esa cita ya está vinculada a otra atención del paciente", 409, [
        { field: "appointmentId", message: "La cita ya está vinculada a otra atención" },
      ])
    }
    created = { ...input, patientId, addenda: [], createdAt: new Date().toISOString() }
    return { ...history, encounters: [...history.encounters, created].sort(compareEncounters) }
  })
  return created as ClinicalEncounter
}

// MOCK-ONLY
async function addEncounterNoteMock(patientId: string, encounterId: string, input: AddEncounterNoteInput): Promise<EncounterNote> {
  await mockDelay(250)
  if (input.text.trim().length < 10) {
    throw new ApiError("La nota debe tener al menos 10 caracteres", 400, [{ field: "text", message: "Mínimo 10 caracteres" }])
  }
  const note: EncounterNote = {
    id: createId(),
    text: input.text.trim(),
    authorName: input.authorName,
    createdAt: new Date().toISOString(),
  }
  await writeHistory(patientId, (history) => {
    if (!history.encounters.some((encounter) => encounter.id === encounterId)) {
      throw new ApiError("Atención no encontrada", 404)
    }
    return {
      ...history,
      encounters: history.encounters.map((encounter) =>
        encounter.id === encounterId ? { ...encounter, addenda: [...encounter.addenda, note] } : encounter
      ),
    }
  })
  return note
}

function assertAttachment(file: File) {
  if (!(allowedAttachmentTypes as readonly string[]).includes(file.type) || file.size > maxAttachmentSize) {
    throw new ApiError(`${file.name}: utiliza JPG, PNG, WebP o PDF de hasta 20 MB`, 400, [
      { field: "file", message: "Formato o tamaño no permitido" },
    ])
  }
}

// MOCK-ONLY
/** Guarda solo el archivo; la historia lo referencia cuando se guardan los cambios. */
async function uploadAttachmentMock(input: UploadAttachmentInput): Promise<DentalAttachment> {
  await mockDelay(200)
  assertAttachment(input.file)
  const attachment: DentalAttachment = {
    id: createId(),
    name: input.file.name,
    kind: input.kind,
    mime: input.file.type,
    size: input.file.size,
    createdAt: new Date().toISOString(),
  }
  await storeFile(input.patientId, attachment.id, input.file)
  return attachment
}

// MOCK-ONLY
async function getAttachmentFileMock(patientId: string, attachmentId: string): Promise<Blob> {
  return readFile(patientId, attachmentId)
}

// TODO: conectar a endpoint real -> GET /clinical-history/encounters?page&pageSize&search&patientId&professionalId
async function listEncountersReal(query: EncounterListQuery): Promise<Paginated<EncounterListItem>> {
  const { data } = await http.get<Paginated<EncounterListItem>>("/clinical-history/encounters", { params: query })
  return data
}

// TODO: conectar a endpoint real -> GET /clinical-history/patients/:patientId (devuelve { record, encounters })
async function getRecordReal(patientId: string): Promise<PatientClinicalHistory> {
  const { data } = await http.get<PatientClinicalHistory>(`/clinical-history/patients/${patientId}`)
  return data
}

// TODO: conectar a endpoint real -> PUT /clinical-history/patients/:patientId (body incluye `revision`; 409 si no coincide)
async function saveRecordReal(record: ClinicalRecord): Promise<ClinicalRecord> {
  const { data } = await http.put<ClinicalRecord>(`/clinical-history/patients/${record.patientId}`, record)
  return data
}

// TODO: conectar a endpoint real -> POST /clinical-history/patients/:patientId/encounters (idempotente por `id`)
async function createEncounterReal(patientId: string, input: CreateEncounterInput): Promise<ClinicalEncounter> {
  const { data } = await http.post<ClinicalEncounter>(`/clinical-history/patients/${patientId}/encounters`, input)
  return data
}

// TODO: conectar a endpoint real -> POST /clinical-history/encounters/:encounterId/notes (el autor sale de la sesión)
async function addEncounterNoteReal(_patientId: string, encounterId: string, input: AddEncounterNoteInput): Promise<EncounterNote> {
  const { data } = await http.post<EncounterNote>(`/clinical-history/encounters/${encounterId}/notes`, { text: input.text })
  return data
}

// TODO: conectar a endpoint real -> POST /clinical-history/attachments (multipart: file, kind, patientId)
async function uploadAttachmentReal(input: UploadAttachmentInput): Promise<DentalAttachment> {
  assertAttachment(input.file)
  const body = new FormData()
  body.append("file", input.file)
  body.append("kind", input.kind)
  body.append("patientId", input.patientId)
  const { data } = await http.post<DentalAttachment>("/clinical-history/attachments", body)
  return data
}

// TODO: conectar a endpoint real -> GET /clinical-history/attachments/:attachmentId/file
async function getAttachmentFileReal(_patientId: string, attachmentId: string): Promise<Blob> {
  const { data } = await http.get<Blob>(`/clinical-history/attachments/${attachmentId}/file`, { responseType: "blob" })
  return data
}

export const clinicalHistoryApi = {
  listEncounters: env.useMockApi ? listEncountersMock : listEncountersReal,
  getRecord: env.useMockApi ? getRecordMock : getRecordReal,
  saveRecord: env.useMockApi ? saveRecordMock : saveRecordReal,
  createEncounter: env.useMockApi ? createEncounterMock : createEncounterReal,
  addEncounterNote: env.useMockApi ? addEncounterNoteMock : addEncounterNoteReal,
  uploadAttachment: env.useMockApi ? uploadAttachmentMock : uploadAttachmentReal,
  getAttachmentFile: env.useMockApi ? getAttachmentFileMock : getAttachmentFileReal,
}
