import type { Paginated } from "@/shared/types/common"

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

export interface RegisterEncounterInput {
  /** Historia guardada (con la revisión que se leyó): la atención copia su odontograma y sus alertas. */
  record: ClinicalRecord
  encounter: CreateEncounterInput
}

export interface RegisterEncounterResult {
  encounter: ClinicalEncounter
  /** Última versión de la historia, si el registro la cambió (propuestos usados o exámenes solicitados). */
  record: ClinicalRecord | null
  appointmentCompleted: boolean
  warnings: string[]
}

/**
 * Historia clínica. `clinical-history.http.ts` lo cumple con la API.
 */
export interface ClinicalHistoryApi {
  listEncounters(query: EncounterListQuery, signal?: AbortSignal): Promise<Paginated<EncounterListItem>>
  /** `{ record, encounters, references }`. Sin historia, una vacía con `revision: 0`. */
  getRecord(patientId: string, signal?: AbortSignal): Promise<PatientClinicalHistory>
  /** `409` si la revisión no es la guardada (otra pestaña o usuario la cambió). */
  saveRecord(record: ClinicalRecord): Promise<ClinicalRecord>
  /**
   * Registra la atención completa: los tratamientos realizados (con sus insumos), la atención, los cambios de
   * la historia (propuestos usados y exámenes solicitados) y la cita completada. Con la API es una sola
   * transacción; reintentar con el mismo `encounter.id` no duplica nada.
   */
  registerEncounter(patientId: string, input: RegisterEncounterInput): Promise<RegisterEncounterResult>
  /** El autor sale de la sesión. */
  addEncounterNote(patientId: string, encounterId: string, input: AddEncounterNoteInput): Promise<EncounterNote>
  /** Solo el archivo: la historia lo referencia cuando se guardan los cambios. */
  uploadAttachment(input: UploadAttachmentInput): Promise<DentalAttachment>
  /** `410` si el protocolo de conservación ya borró el original. */
  getAttachmentFile(patientId: string, attachmentId: string, signal?: AbortSignal): Promise<Blob>
}
