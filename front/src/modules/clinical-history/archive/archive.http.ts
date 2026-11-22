import type { components } from "@/shared/api/schema"
import { apiBlob, apiForm, apiGet, apiPatch, apiPost, apiPut } from "@/shared/lib/http"

import { toHistory } from "../api/clinical-history.http"
import type { ArchiveApi } from "./archive.contract"
import { createClinicalThumbnail } from "./lib/files"
import type { ArchiveCatalog, ClinicalFileDraft } from "./types"

type Schemas = components["schemas"]
type HistoryDto = Schemas["PatientClinicalHistoryDto"]

const toCatalog = (dto: Schemas["ArchiveCatalogDto"]): ArchiveCatalog => dto

/** Los campos vacíos del borrador no se envían; `tagIds` va una vez por etiqueta. */
function draftForm(original: File, draft: ClinicalFileDraft): FormData {
  const form = new FormData()
  form.append("file", original)
  for (const [key, value] of Object.entries(draft)) {
    if (key === "tagIds") (value as string[]).forEach((tagId) => form.append("tagIds", tagId))
    else if (value !== null && value !== "") form.append(key, String(value))
  }
  return form
}

export const httpArchiveApi: ArchiveApi = {
  async catalog(signal) {
    return toCatalog(await apiGet<Schemas["ArchiveCatalogDto"]>("/clinical-history/archive/catalog", { signal }))
  },
  async attach(patientId, original, draft) {
    // El SHA-256, los duplicados y el vínculo con el examen los resuelve el servidor.
    return toHistory(await apiForm<HistoryDto>(`/clinical-history/patients/${patientId}/archive/files`, draftForm(original, draft)))
  },
  async edit(_patientId, id, version, draft) {
    return toHistory(await apiPatch<HistoryDto>(`/clinical-history/attachments/${id}`, { ...draft, version }))
  },
  async archive(_patientId, id, version, archived) {
    return toHistory(await apiPost<HistoryDto>(`/clinical-history/attachments/${id}/${archived ? "archive" : "restore"}`, { version }))
  },
  async original(_patientId, id, signal) {
    return apiBlob(`/clinical-history/attachments/${id}/file`, { signal })
  },
  async thumbnail(patientId, id, signal) {
    // La miniatura se genera en el navegador desde el original; React Query la guarda en memoria.
    const original = await this.original(patientId, id, signal)
    return original.type.startsWith("image/") ? createClinicalThumbnail(original) : null
  },
  async category({ id, ...input }) {
    const body: Schemas["ArchiveCategoryRequest"] = input
    const catalog = id
      ? await apiPut<Schemas["ArchiveCatalogDto"]>(`/clinical-history/archive/categories/${id}`, body)
      : await apiPost<Schemas["ArchiveCatalogDto"]>("/clinical-history/archive/categories", body)
    return toCatalog(catalog)
  },
  async tag(name, id, version) {
    const catalog = id
      ? await apiPut<Schemas["ArchiveCatalogDto"]>(`/clinical-history/archive/tags/${id}`, { name, version })
      : await apiPost<Schemas["ArchiveCatalogDto"]>("/clinical-history/archive/tags", { name })
    return toCatalog(catalog)
  },
}
