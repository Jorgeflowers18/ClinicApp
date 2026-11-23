import type { PatientClinicalHistory } from "../types/clinical-history.types"
import type { ArchiveCatalog, ArchiveCategory, ClinicalFileDraft } from "./types"

/**
 * Archivo clínico digital. `archive.http.ts` lo cumple con la API.
 *
 * Cada escritura devuelve la historia completa (o el catálogo), para reemplazarla en la caché. Las reglas
 * (duplicados por SHA-256, vínculos con atención, examen y tratamiento, versiones) las valida el servidor.
 */
export interface ArchiveApi {
  catalog(signal?: AbortSignal): Promise<ArchiveCatalog>
  /** Adjunta un original con sus metadatos. `409` en `errors.file` si ya está registrado para el paciente. */
  attach(patientId: string, original: File, draft: ClinicalFileDraft): Promise<PatientClinicalHistory>
  /** `409` si `version` ya no es la guardada (otra pantalla lo cambió). */
  edit(patientId: string, id: string, version: number, draft: ClinicalFileDraft): Promise<PatientClinicalHistory>
  archive(patientId: string, id: string, version: number, archived: boolean): Promise<PatientClinicalHistory>
  original(patientId: string, id: string, signal?: AbortSignal): Promise<Blob>
  /** Miniatura de una imagen (`null` si no es imagen). */
  thumbnail(patientId: string, id: string, signal?: AbortSignal): Promise<Blob | null>
  /** Crea (sin `id`) o actualiza una categoría. Devuelve el catálogo completo. */
  category(input: Omit<ArchiveCategory, "id" | "version"> & { id?: string; version?: number }): Promise<ArchiveCatalog>
  /** Crea (sin `id`) o renombra una etiqueta. Crear una que ya existe devuelve el catálogo sin cambios. */
  tag(name: string, id?: string, version?: number): Promise<ArchiveCatalog>
}
