export interface ArchiveActor { id: string; name: string }
export interface ArchiveAudit { action: "adjuntar" | "editar" | "archivar" | "restaurar"; at: string; actor: ArchiveActor; fields: string[] }

/** Optional, additive metadata: legacy file identity, original name and bytes stay intact. */
export interface ClinicalFileMetadata {
  version: number
  displayName: string
  clinicalType: string
  studyDate: string | null
  categoryId: string | null
  tagIds: string[]
  professionalId: string | null
  encounterId: string | null
  treatmentId: string | null
  examRequestId: string | null
  zone: string
  notes: string
  digest?: string
  uploadedBy?: ArchiveActor
  updatedAt: string
  archivedAt: string | null
  audit: ArchiveAudit[]
}

export interface ArchiveCategory {
  id: string; name: string; description: string; color: string; archivedAt: string | null; version: number
}
export interface ArchiveTag { id: string; name: string; version: number }
export interface ArchiveCatalog { id: "local-institution"; revision: number; categories: ArchiveCategory[]; tags: ArchiveTag[] }

export type ClinicalFileDraft = Pick<ClinicalFileMetadata, "displayName" | "clinicalType" | "studyDate" | "categoryId" | "tagIds" | "professionalId" | "encounterId" | "treatmentId" | "examRequestId" | "zone" | "notes">
export const emptyFileDraft = (): ClinicalFileDraft => ({ displayName: "", clinicalType: "", studyDate: null, categoryId: null, tagIds: [], professionalId: null, encounterId: null, treatmentId: null, examRequestId: null, zone: "", notes: "" })
export const emptyArchiveCatalog = (): ArchiveCatalog => ({ id: "local-institution", revision: 0, categories: [], tags: [] })

/** Preserve recognized metadata from older records; never manufacture historical audit entries. */
export function readFileMetadata(value: unknown): ClinicalFileMetadata | undefined {
  if (!value || typeof value !== "object") return undefined
  const raw = value as Partial<ClinicalFileMetadata>
  const text = (key: keyof ClinicalFileMetadata) => typeof raw[key] === "string" ? raw[key] as string : ""
  const nullable = (key: keyof ClinicalFileMetadata) => text(key) || null
  return {
    version: Number.isInteger(raw.version) ? raw.version! : 0,
    displayName: text("displayName"), clinicalType: text("clinicalType"), studyDate: nullable("studyDate"),
    categoryId: nullable("categoryId"), professionalId: nullable("professionalId"), encounterId: nullable("encounterId"),
    treatmentId: nullable("treatmentId"), examRequestId: nullable("examRequestId"),
    tagIds: Array.isArray(raw.tagIds) ? raw.tagIds.filter((id): id is string => typeof id === "string") : [],
    zone: text("zone"), notes: text("notes"), digest: text("digest") || undefined,
    uploadedBy: raw.uploadedBy && typeof raw.uploadedBy.id === "string" && typeof raw.uploadedBy.name === "string" ? raw.uploadedBy : undefined,
    updatedAt: text("updatedAt"), archivedAt: nullable("archivedAt"),
    audit: Array.isArray(raw.audit) ? raw.audit.filter((item) => item && typeof item.at === "string" && item.actor && typeof item.actor.id === "string" && typeof item.actor.name === "string" && Array.isArray(item.fields)) : [],
  }
}
