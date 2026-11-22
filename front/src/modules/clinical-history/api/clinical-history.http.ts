import type { components } from "@/shared/api/schema"
import { apiBlob, apiForm, apiGet, apiPost, apiPut } from "@/shared/lib/http"
import type { Paginated } from "@/shared/types/common"

import type { ClinicalHistoryApi } from "./clinical-history.contract"
import type {
  ClinicalEncounter,
  ClinicalRecord,
  DentalAttachment,
  EncounterListItem,
  PatientClinicalHistory,
} from "../types/clinical-history.types"
import { assertAttachment } from "../lib/attachments"

type Schemas = components["schemas"]

/*
 * El back se construyó con la forma de `clinical-history.types.ts` (mismos nombres y anidamiento). Los
 * DTO generados tipan cada sección por separado, así que el mapeo convierte solo lo que difiere: los `null`
 * de campos que el frontend tipa como opcionales. Los `null` con sentido (snapshots, metadatos del archivo,
 * `treatmentId` heredado) se conservan.
 */
export const toAttachment = (dto: Schemas["DentalAttachmentDto"]): DentalAttachment => ({
  ...dto,
  kind: dto.kind as DentalAttachment["kind"],
  // Un adjunto que nunca se clasificó no tiene metadatos.
  archive: dto.archive
    ? {
        ...dto.archive,
        digest: dto.archive.digest ?? undefined,
        uploadedBy: dto.archive.uploadedBy ?? undefined,
        updatedAt: dto.archive.updatedAt ?? "",
        audit: dto.archive.audit as NonNullable<DentalAttachment["archive"]>["audit"],
      }
    : undefined,
})

export const toRecord = (dto: Schemas["ClinicalRecordDto"]): ClinicalRecord =>
  ({ ...dto, attachments: dto.attachments.map(toAttachment) }) as unknown as ClinicalRecord

const toEncounter = (dto: Schemas["ClinicalEncounterDto"]): ClinicalEncounter =>
  ({ ...dto, legacyProfessionalName: dto.legacyProfessionalName ?? undefined }) as unknown as ClinicalEncounter

export const toHistory = (dto: Schemas["PatientClinicalHistoryDto"]): PatientClinicalHistory => ({
  record: toRecord(dto.record),
  encounters: dto.encounters.map(toEncounter),
  references: dto.references,
})

const toListItem = (dto: Schemas["EncounterListItemDto"]): EncounterListItem =>
  ({ ...dto, legacyProfessionalName: dto.legacyProfessionalName ?? undefined }) as unknown as EncounterListItem

export const httpClinicalHistoryApi: ClinicalHistoryApi = {
  async listEncounters(query, signal) {
    const page = await apiGet<Paginated<Schemas["EncounterListItemDto"]>>("/clinical-history/encounters", { params: query, signal })
    return { ...page, items: page.items.map(toListItem) }
  },
  async getRecord(patientId, signal) {
    return toHistory(await apiGet<Schemas["PatientClinicalHistoryDto"]>(`/clinical-history/patients/${patientId}`, { signal }))
  },
  async saveRecord(record) {
    // El body es la historia con la `revision` que se leyó; el servidor responde 409 si ya cambió.
    return toRecord(await apiPut<Schemas["ClinicalRecordDto"]>(`/clinical-history/patients/${record.patientId}`, record))
  },
  async registerEncounter(patientId, input) {
    // Una sola transacción en el servidor: tratamientos realizados, atención, historia y cita.
    const result = await apiPost<Schemas["RegisterEncounterResultDto"]>(`/clinical-history/patients/${patientId}/encounters/register`, input.encounter)
    return {
      encounter: toEncounter(result.encounter),
      record: result.record ? toRecord(result.record) : null,
      appointmentCompleted: result.appointmentCompleted,
      warnings: result.warnings,
    }
  },
  async addEncounterNote(_patientId, encounterId, input) {
    return apiPost(`/clinical-history/encounters/${encounterId}/notes`, { text: input.text })
  },
  async uploadAttachment(input) {
    assertAttachment(input.file)
    const body = new FormData()
    body.append("file", input.file)
    body.append("kind", input.kind)
    body.append("patientId", input.patientId)
    return toAttachment(await apiForm<Schemas["DentalAttachmentDto"]>("/clinical-history/attachments", body))
  },
  async getAttachmentFile(_patientId, attachmentId, signal) {
    return apiBlob(`/clinical-history/attachments/${attachmentId}/file`, { signal })
  },
}
