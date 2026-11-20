import { attachmentKindLabels, attachmentKinds, type AttachmentKind, type DentalAttachment } from "../../types/clinical-history.types"
import type { ArchiveCatalog, ClinicalFileDraft } from "../types"

export const clinicalFileTypes: Record<string, string> = {
  ...Object.fromEntries(attachmentKinds.map((key) => [key, attachmentKindLabels[key]])),
  fotografias: "Fotografía clínica", panoramica: "Radiografía panorámica", bitewing: "Radiografía de aleta de mordida",
  cbct: "Tomografía (imagen o informe)", modelos: "Escaneo intraoral (imagen o informe)",
  radiografia_cefalometrica: "Radiografía cefalométrica", examen_complementario: "Examen complementario",
  informe_medico: "Informe médico", documento_clinico: "Documento clínico", otro: "Otro",
}
export const legacyFileKind = (type: string): AttachmentKind => attachmentKinds.includes(type as AttachmentKind) ? type as AttachmentKind : "otro"
export const fileName = (file: DentalAttachment) => file.archive?.displayName || file.name
export const fileClinicalType = (file: DentalAttachment) => file.archive?.clinicalType || file.kind
export const fileTypeLabel = (file: DentalAttachment) => clinicalFileTypes[fileClinicalType(file)] || "Clasificación anterior"
export const fileCategory = (file: DentalAttachment, catalog: ArchiveCatalog) => catalog.categories.find((item) => item.id === file.archive?.categoryId)
export const fileVersion = (file: DentalAttachment) => file.archive?.version ?? 0
export const isClinicalImage = (file: DentalAttachment) => ["image/jpeg", "image/png", "image/webp"].includes(file.mime)
export const isImagingStudy = (file: DentalAttachment) => ["radiografia_periapical", "panoramica", "bitewing", "radiografia_cefalometrica", "cbct", "modelos"].includes(fileClinicalType(file))
export const fileDraft = (file: DentalAttachment): ClinicalFileDraft => ({
  displayName: fileName(file), clinicalType: fileClinicalType(file), studyDate: file.archive?.studyDate ?? null,
  categoryId: file.archive?.categoryId ?? null, tagIds: file.archive?.tagIds ?? [], professionalId: file.archive?.professionalId ?? null,
  encounterId: file.archive?.encounterId ?? null, treatmentId: file.archive?.treatmentId ?? null, examRequestId: file.archive?.examRequestId ?? null,
  zone: file.archive?.zone ?? "", notes: file.archive?.notes ?? "",
})
export const archiveText = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es")
export const bytesLabel = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toLocaleString("es", { maximumFractionDigits: 1 })} MB`
export const formatLabel = (file: Pick<DentalAttachment, "mime">) => ({ "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WebP", "application/pdf": "PDF" }[file.mime] || file.mime || "Formato por verificar")
