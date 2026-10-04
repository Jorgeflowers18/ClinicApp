import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { createId } from "@/shared/lib/id"
import { mockDelay, paginate } from "@/shared/lib/mock"
import { ApiError, type Paginated } from "@/shared/types/common"
import { mockPatients } from "@/modules/patients/api/patients.mock-data"

import { assignablePlanStatuses, allowedAttachmentTypes, maxAttachmentSize } from "../types/clinical-history.types"
import type {
  DentalAttachment,
  DentalRecord,
  DentalVisit,
  StartVisitInput,
  UploadAttachmentInput,
  VisitListItem,
  VisitListQuery,
} from "../types/clinical-history.types"
import { compareVisits, findDraft, latestClosedVisit, today, validateVisitForClose } from "../lib/visit"
import { readAllRecords, readFile, readRecord, seedOnce, storeFile, writeRecord } from "./clinical-history.mock-storage"
import { seedVisitsByPatient } from "./clinical-history.mock-data"

function toListItem(visit: DentalVisit): VisitListItem {
  return {
    id: visit.id,
    patientId: visit.patientId,
    status: visit.status,
    date: visit.date,
    professionalId: visit.professionalId,
    legacyProfessionalName: visit.legacyProfessionalName,
    reason: visit.reason,
    diagnosis: visit.diagnosis,
    nextVisit: visit.nextVisit,
    closedAt: visit.closedAt,
  }
}

// MOCK-ONLY
const ensureSeeded = () => seedOnce(seedVisitsByPatient)

// MOCK-ONLY
function assertAppointmentFree(record: DentalRecord, appointmentId: string | null, visitId?: string) {
  if (!appointmentId) return
  const other = record.visits.find((visit) => visit.appointmentId === appointmentId && visit.id !== visitId)
  if (other) {
    throw new ApiError("Esa cita ya está vinculada a otra visita del paciente", 409, [
      { field: "appointmentId", message: "La cita ya está vinculada a otra visita" },
    ])
  }
}

// MOCK-ONLY
function replaceVisit(record: DentalRecord, next: DentalVisit): DentalRecord {
  return { ...record, visits: record.visits.map((visit) => (visit.id === next.id ? next : visit)).sort(compareVisits) }
}

// MOCK-ONLY
function assertEditable(record: DentalRecord, visit: DentalVisit) {
  const stored = record.visits.find((item) => item.id === visit.id)
  if (!stored) throw new ApiError("Visita no encontrada", 404)
  if (stored.status === "cerrada") throw new ApiError("La visita ya está cerrada y no se puede modificar", 409)
  if (stored.revision !== visit.revision) {
    throw new ApiError("Otra pestaña o usuario modificó esta visita. Recarga la historia antes de continuar.", 409)
  }
  return stored
}

// MOCK-ONLY
async function listVisitsMock(query: VisitListQuery): Promise<Paginated<VisitListItem>> {
  await mockDelay(250)
  await ensureSeeded()
  const search = query.search?.trim().toLowerCase()
  const visits = (await readAllRecords())
    .flatMap((record) => record.visits)
    .filter((visit) => !query.patientId || visit.patientId === query.patientId)
    .filter((visit) => !query.professionalId || visit.professionalId === query.professionalId)
    .filter((visit) => !query.status || visit.status === query.status)
    .filter((visit) => {
      if (!search) return true
      const patient = mockPatients.find((item) => item.id === visit.patientId)
      return [visit.reason, visit.diagnosis, patient?.firstName, patient?.lastName, patient?.documentId]
        .join(" ")
        .toLowerCase()
        .includes(search)
    })
    .sort((a, b) => compareVisits(b, a))
  return paginate(visits.map(toListItem), query)
}

// MOCK-ONLY
async function getRecordMock(patientId: string): Promise<DentalRecord> {
  await mockDelay(200)
  await ensureSeeded()
  return readRecord(patientId)
}

// MOCK-ONLY
/** Devuelve el borrador existente o crea uno que parte del odontograma y los ítems propuestos de la última visita cerrada. */
async function startVisitMock(patientId: string, input: StartVisitInput): Promise<DentalVisit> {
  await mockDelay(250)
  await ensureSeeded()
  let started: DentalVisit | undefined
  await writeRecord(patientId, (record) => {
    const draft = findDraft(record)
    if (draft) {
      started = draft
      return record
    }
    assertAppointmentFree(record, input.appointmentId)
    const previous = latestClosedVisit(record)
    const now = new Date().toISOString()
    started = {
      id: createId(),
      patientId,
      status: "borrador",
      revision: 0,
      date: input.date || today(),
      professionalId: input.professionalId,
      appointmentId: input.appointmentId,
      reason: "",
      diagnosis: "",
      procedures: "",
      evolution: "",
      notes: "",
      nextVisit: "",
      chart: previous?.chart ? structuredClone(previous.chart) : null,
      // Solo se arrastran las propuestas: lo aprobado ya vive como asignación en Tratamientos.
      plan: (previous?.plan ?? [])
        .filter((item) => item.status === "pendiente" && !item.assignmentId)
        .map((item) => ({ ...item, id: createId() })),
      consents: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    }
    return { ...record, visits: [...record.visits, started].sort(compareVisits) }
  })
  return started as DentalVisit
}

// MOCK-ONLY
async function saveDraftMock(visit: DentalVisit): Promise<DentalVisit> {
  let saved: DentalVisit | undefined
  await writeRecord(visit.patientId, (record) => {
    assertEditable(record, visit)
    assertAppointmentFree(record, visit.appointmentId, visit.id)
    saved = { ...visit, status: "borrador", revision: visit.revision + 1, updatedAt: new Date().toISOString() }
    return replaceVisit(record, saved)
  })
  return saved as DentalVisit
}

// MOCK-ONLY
async function closeVisitMock(visit: DentalVisit): Promise<DentalVisit> {
  await mockDelay(300)
  const fieldErrors = validateVisitForClose(visit)
  if (fieldErrors.length) throw new ApiError("Completa los datos obligatorios antes de cerrar la visita", 400, fieldErrors)
  const pendingAssignment = visit.plan.findIndex((item) => assignablePlanStatuses.includes(item.status) && !item.assignmentId)
  if (pendingAssignment !== -1) {
    throw new ApiError("Hay tratamientos aprobados sin asignación creada", 400, [
      { field: `plan.${pendingAssignment}.treatmentId`, message: "No se pudo crear la asignación de este tratamiento" },
    ])
  }
  let closed: DentalVisit | undefined
  await writeRecord(visit.patientId, (record) => {
    assertEditable(record, visit)
    assertAppointmentFree(record, visit.appointmentId, visit.id)
    const now = new Date().toISOString()
    closed = { ...visit, status: "cerrada", revision: visit.revision + 1, updatedAt: now, closedAt: now }
    return replaceVisit(record, closed)
  })
  return closed as DentalVisit
}

// MOCK-ONLY
async function discardDraftMock(patientId: string, visitId: string): Promise<void> {
  await mockDelay(250)
  await writeRecord(patientId, (record) => {
    const visit = record.visits.find((item) => item.id === visitId)
    if (!visit) throw new ApiError("Visita no encontrada", 404)
    if (visit.status !== "borrador") throw new ApiError("Solo se pueden descartar visitas en borrador", 409)
    return { ...record, visits: record.visits.filter((item) => item.id !== visitId) }
  })
}

function assertAttachment(file: File) {
  if (!(allowedAttachmentTypes as readonly string[]).includes(file.type) || file.size > maxAttachmentSize) {
    throw new ApiError(`${file.name}: utiliza JPG, PNG, WebP o PDF de hasta 20 MB`, 400, [
      { field: "file", message: "Formato o tamaño no permitido" },
    ])
  }
}

// MOCK-ONLY
/** Guarda solo el archivo; la visita lo referencia en el siguiente guardado del borrador. */
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

// TODO: conectar a endpoint real -> GET /clinical-history/visits?page&pageSize&search&patientId&professionalId&status
async function listVisitsReal(query: VisitListQuery): Promise<Paginated<VisitListItem>> {
  const { data } = await http.get<Paginated<VisitListItem>>("/clinical-history/visits", { params: query })
  return data
}

// TODO: conectar a endpoint real -> GET /clinical-history/patients/:patientId
async function getRecordReal(patientId: string): Promise<DentalRecord> {
  const { data } = await http.get<DentalRecord>(`/clinical-history/patients/${patientId}`)
  return data
}

// TODO: conectar a endpoint real -> POST /clinical-history/patients/:patientId/visits
async function startVisitReal(patientId: string, input: StartVisitInput): Promise<DentalVisit> {
  const { data } = await http.post<DentalVisit>(`/clinical-history/patients/${patientId}/visits`, input)
  return data
}

// TODO: conectar a endpoint real -> PUT /clinical-history/visits/:visitId (body incluye `revision`; 409 si no coincide)
async function saveDraftReal(visit: DentalVisit): Promise<DentalVisit> {
  const { data } = await http.put<DentalVisit>(`/clinical-history/visits/${visit.id}`, visit)
  return data
}

// TODO: conectar a endpoint real -> POST /clinical-history/visits/:visitId/close
async function closeVisitReal(visit: DentalVisit): Promise<DentalVisit> {
  const { data } = await http.post<DentalVisit>(`/clinical-history/visits/${visit.id}/close`, visit)
  return data
}

// TODO: conectar a endpoint real -> DELETE /clinical-history/visits/:visitId (solo borradores)
async function discardDraftReal(_patientId: string, visitId: string): Promise<void> {
  await http.delete(`/clinical-history/visits/${visitId}`)
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
  listVisits: env.useMockApi ? listVisitsMock : listVisitsReal,
  getRecord: env.useMockApi ? getRecordMock : getRecordReal,
  startVisit: env.useMockApi ? startVisitMock : startVisitReal,
  saveDraft: env.useMockApi ? saveDraftMock : saveDraftReal,
  closeVisit: env.useMockApi ? closeVisitMock : closeVisitReal,
  discardDraft: env.useMockApi ? discardDraftMock : discardDraftReal,
  uploadAttachment: env.useMockApi ? uploadAttachmentMock : uploadAttachmentReal,
  getAttachmentFile: env.useMockApi ? getAttachmentFileMock : getAttachmentFileReal,
}
