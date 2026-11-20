import { env } from "@/shared/lib/env"
import { createId } from "@/shared/lib/id"
import { ApiError } from "@/shared/types/common"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { patientsApi } from "@/modules/patients/api/patients.api"
import { appointmentsApi } from "@/modules/appointments/api/appointments.api"
import { treatmentsApi } from "@/modules/treatments/api/treatments.api"
import { clinicalHistoryApi } from "../api/clinical-history.api"
import { readArchiveCatalog, writeArchiveCatalog, writeHistory, readFile, readThumbnail, cacheThumbnail } from "../api/clinical-history.mock-storage"
import type { DentalAttachment, PatientClinicalHistory } from "../types/clinical-history.types"
import { emptyArchiveCatalog, type ArchiveActor, type ArchiveCategory, type ArchiveTag, type ClinicalFileDraft } from "./types"
import { archiveText, clinicalFileTypes, fileDraft, fileVersion, legacyFileKind } from "./lib/classification"
import { createClinicalThumbnail, inspectClinicalFile } from "./lib/files"

/** Defense in depth for the local demo; server authorization is still required in production. */
export function archiveActor(): ArchiveActor {
  const user = useAuthStore.getState().user
  if (!user || !["admin", "medico"].includes(user.role)) throw new ApiError("No tienes permiso para consultar el archivo clínico.", 403)
  return { id: user.id, name: user.name }
}
function assertSession(actor: ArchiveActor) {
  if (archiveActor().id !== actor.id) throw new ApiError("La sesión cambió. Vuelve a abrir el archivo clínico.", 403)
}
function writable() {
  if (!env.useMockApi) throw new ApiError("La API actual aún no ofrece metadatos, catálogos ni archivado. Esta operación solo está disponible en la demostración local.", 501)
}
async function context(patientId: string) {
  const actor = archiveActor()
  await patientsApi.get(patientId)
  const history = await clinicalHistoryApi.getRecord(patientId)
  if (history.record.patientId !== patientId) throw new ApiError("La historia no corresponde a este paciente.", 403)
  assertSession(actor)
  return { actor, history }
}
function findFile(history: PatientClinicalHistory, id: string) {
  const file = history.record.attachments.find((item) => item.id === id)
  if (!file) throw new ApiError("Archivo no disponible para este paciente.", 404)
  return file
}
function validDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
async function validateDraft(patientId: string, draft: ClinicalFileDraft, history: PatientClinicalHistory) {
  if (!draft.displayName.trim() || draft.displayName.length > 200) throw new ApiError("Escribe un nombre de hasta 200 caracteres.", 400)
  if (!clinicalFileTypes[draft.clinicalType]) throw new ApiError("Selecciona el tipo clínico del archivo.", 400)
  if (draft.studyDate && !validDate(draft.studyDate)) throw new ApiError("La fecha de estudio no es válida.", 400)
  if (draft.notes.length > 3000 || draft.zone.length > 150) throw new ApiError("Las notas admiten 3000 caracteres y la zona 150.", 400)
  if (draft.encounterId && !history.encounters.some((item) => item.id === draft.encounterId)) throw new ApiError("La atención no pertenece a este paciente.", 400)
  if (draft.examRequestId && !history.record.examRequests.some((item) => item.id === draft.examRequestId)) throw new ApiError("El examen no pertenece a este paciente.", 400)
  if (draft.treatmentId) {
    const assignments = await treatmentsApi.listAssignmentsByPatient(patientId)
    if (!assignments.some((item) => item.id === draft.treatmentId && item.patientId === patientId)) throw new ApiError("El tratamiento no pertenece a este paciente.", 400)
  }
  if (draft.professionalId && !(await appointmentsApi.listProfessionals()).some((item) => item.id === draft.professionalId)) throw new ApiError("El profesional ya no está disponible.", 400)
  const catalog = await readArchiveCatalog()
  if (draft.categoryId && !catalog.categories.some((item) => item.id === draft.categoryId)) throw new ApiError("La categoría no está disponible.", 400)
  if (draft.tagIds.some((id) => !catalog.tags.some((item) => item.id === id))) throw new ApiError("Una etiqueta ya no está disponible.", 400)
}
function linkExam(history: PatientClinicalHistory, draft: ClinicalFileDraft, fileId: string) {
  if (!draft.examRequestId) return history.record.examRequests
  return history.record.examRequests.map((exam) => {
    if (exam.id !== draft.examRequestId) return exam
    if (exam.attachmentId && exam.attachmentId !== fileId) throw new ApiError("Este examen ya tiene un resultado. Recarga antes de continuar.", 409)
    const date = new Date()
    const receivedAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    return { ...exam, status: "recibido" as const, attachmentId: fileId, receivedAt: exam.receivedAt ?? receivedAt }
  })
}
export const archiveApi = {
  async catalog() { const actor = archiveActor(); const value = env.useMockApi ? await readArchiveCatalog() : emptyArchiveCatalog(); assertSession(actor); return value },
  async attach(patientId: string, original: File, draft: ClinicalFileDraft) {
    writable()
    const { actor, history } = await context(patientId)
    await validateDraft(patientId, draft, history)
    const inspected = await inspectClinicalFile(original)
    // Include legacy originals in duplicate detection without rewriting their metadata.
    for (const existing of history.record.attachments.filter((item) => item.size === original.size)) {
      let digest = existing.archive?.digest
      if (!digest) {
        try { digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await (await readFile(patientId, existing.id)).arrayBuffer()))).map((v) => v.toString(16).padStart(2, "0")).join("") }
        catch (error) { throw new ApiError(`No se pudo comprobar un original anterior: ${error instanceof Error ? error.message : "archivo no disponible"}. Revisa el archivo antes de reintentar.`, 409) }
      }
      if (digest === inspected.digest) throw new ApiError("Este original ya está registrado para el paciente, incluso si está archivado.", 409)
    }
    assertSession(actor)
    const id = createId(), at = new Date().toISOString()
    const file: DentalAttachment = {
      id, name: original.name, kind: legacyFileKind(draft.clinicalType), mime: inspected.mime, size: original.size, createdAt: at,
      archive: { ...draft, displayName: draft.displayName.trim(), version: 1, digest: inspected.digest, uploadedBy: actor, updatedAt: at, archivedAt: null, audit: [{ action: "adjuntar", at, actor, fields: Object.keys(draft) }] }
    }
    return writeHistory(patientId, (current) => {
      assertSession(actor)
      if (current.record.attachments.some((item) => item.archive?.digest === inspected.digest)) throw new ApiError("Este original ya se guardó. No se duplicó.", 409)
      if (draft.encounterId && !current.encounters.some((item) => item.id === draft.encounterId)) throw new ApiError("Atención no disponible.", 409)
      return { ...current, record: { ...current.record, attachments: [...current.record.attachments, file], examRequests: linkExam(current, draft, id), revision: current.record.revision + 1, updatedAt: at } }
    }, [{ id, file: inspected.file, thumbnail: inspected.thumbnail }])
  },
  async edit(patientId: string, id: string, version: number, draft: ClinicalFileDraft) {
    writable()
    const { actor, history } = await context(patientId)
    const previous = findFile(history, id)
    await validateDraft(patientId, draft, history)
    if (previous.archive?.examRequestId !== (draft.examRequestId ?? undefined) && previous.archive?.examRequestId) throw new ApiError("El vínculo del resultado se conserva. No puede reasignarse desde los metadatos.", 400)
    const at = new Date().toISOString()
    return writeHistory(patientId, (current) => {
      assertSession(actor)
      const file = findFile(current, id)
      if (fileVersion(file) !== version) throw new ApiError("El archivo cambió en otra pantalla. Recarga antes de editar.", 409)
      const fields = Object.keys(draft).filter((key) => JSON.stringify(draft[key as keyof ClinicalFileDraft]) !== JSON.stringify(fileDraft(file)[key as keyof ClinicalFileDraft]))
      const updated: DentalAttachment = { ...file, archive: { ...file.archive, ...draft, displayName: draft.displayName.trim(), version: version + 1, updatedAt: at, archivedAt: file.archive?.archivedAt ?? null, audit: [...file.archive?.audit ?? [], { action: "editar", at, actor, fields }] } }
      return { ...current, record: { ...current.record, attachments: current.record.attachments.map((item) => item.id === id ? updated : item), examRequests: linkExam(current, draft, id), revision: current.record.revision + 1, updatedAt: at } }
    })
  },
  async archive(patientId: string, id: string, version: number, archived: boolean) {
    writable(); const { actor } = await context(patientId); const at = new Date().toISOString()
    return writeHistory(patientId, (current) => {
      assertSession(actor); const file = findFile(current, id)
      if (fileVersion(file) !== version) throw new ApiError("El archivo cambió. Recarga antes de continuar.", 409)
      const updated: DentalAttachment = { ...file, archive: { ...fileDraft(file), ...file.archive, version: version + 1, updatedAt: at, archivedAt: archived ? at : null, audit: [...file.archive?.audit ?? [], { action: archived ? "archivar" : "restaurar", at, actor, fields: ["archivedAt"] }] } }
      return { ...current, record: { ...current.record, attachments: current.record.attachments.map((item) => item.id === id ? updated : item), revision: current.record.revision + 1, updatedAt: at } }
    })
  },
  async original(patientId: string, id: string) {
    const { actor, history } = await context(patientId); findFile(history, id)
    const blob = await clinicalHistoryApi.getAttachmentFile(patientId, id); assertSession(actor); return blob
  },
  async thumbnail(patientId: string, id: string) {
    const { actor, history } = await context(patientId); const file = findFile(history, id)
    if (!file.mime.startsWith("image/")) return null
    if (env.useMockApi) { const cached = await readThumbnail(patientId, id); if (cached) { assertSession(actor); return cached } }
    const thumbnail = await createClinicalThumbnail(await clinicalHistoryApi.getAttachmentFile(patientId, id)); assertSession(actor)
    if (env.useMockApi) { try { await cacheThumbnail(patientId, id, thumbnail) } catch { /* The disposable derivative may be regenerated if storage is full. */ } }
    return thumbnail
  },
  async category(input: Omit<ArchiveCategory, "id" | "version"> & { id?: string; version?: number }) {
    writable(); const actor = archiveActor()
    if (!input.name.trim() || input.name.trim().length > 60 || input.description.length > 300) throw new ApiError("La categoría necesita un nombre de hasta 60 caracteres y una descripción de hasta 300.", 400)
    if (!["neutral", "cyan", "violet", "amber", "green"].includes(input.color)) throw new ApiError("Color de categoría no válido.", 400)
    return writeArchiveCatalog((catalog) => {
      assertSession(actor)
      if (catalog.categories.some((item) => item.id !== input.id && archiveText(item.name) === archiveText(input.name))) throw new ApiError("Ya existe una categoría con ese nombre.", 409)
      const existing = catalog.categories.find((item) => item.id === input.id)
      if (input.id && (!existing || existing.version !== input.version)) throw new ApiError("La categoría cambió. Recarga el catálogo.", 409)
      const category: ArchiveCategory = { ...input, name: input.name.trim().replace(/\s+/g, " "), id: input.id ?? createId(), version: (existing?.version ?? 0) + 1 }
      return { ...catalog, revision: catalog.revision + 1, categories: existing ? catalog.categories.map((item) => item.id === category.id ? category : item) : [...catalog.categories, category] }
    })
  },
  async tag(name: string, id?: string, version?: number) {
    writable(); const actor = archiveActor()
    if (!name.trim() || name.trim().length > 40) throw new ApiError("La etiqueta necesita un nombre de hasta 40 caracteres.", 400)
    return writeArchiveCatalog((catalog) => {
      assertSession(actor)
      const duplicate = catalog.tags.find((item) => item.id !== id && archiveText(item.name) === archiveText(name))
      if (duplicate) { if (!id) return catalog; throw new ApiError("Ya existe esa etiqueta.", 409) }
      const existing = catalog.tags.find((item) => item.id === id)
      if (id && (!existing || existing.version !== version)) throw new ApiError("La etiqueta cambió. Recarga el catálogo.", 409)
      const tag: ArchiveTag = { id: id ?? createId(), name: name.trim().replace(/\s+/g, " "), version: (existing?.version ?? 0) + 1 }
      return { ...catalog, revision: catalog.revision + 1, tags: existing ? catalog.tags.map((item) => item.id === id ? tag : item) : [...catalog.tags, tag] }
    })
  },
}
