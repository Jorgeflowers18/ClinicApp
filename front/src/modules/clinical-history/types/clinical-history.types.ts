import { z } from "zod"
import type { OdontogramSummary } from "react-advanced-odontogram"

import type { PageQuery } from "@/shared/types/common"

export const dataConsentStatuses = ["pendiente", "aceptado", "rechazado"] as const
export type DataConsentStatus = (typeof dataConsentStatuses)[number]

export const dataConsentStatusLabels: Record<DataConsentStatus, string> = {
  pendiente: "Pendiente",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
}

export const dataConsentSigners = ["paciente", "representante"] as const
export type DataConsentSigner = (typeof dataConsentSigners)[number]

export const dataConsentSignerLabels: Record<DataConsentSigner, string> = {
  paciente: "Paciente",
  representante: "Representante",
}

/** Texto provisional hasta que la clínica entregue el texto legal definitivo. */
export const dataConsentText =
  "Autorizo a la clínica a almacenar y tratar mis datos personales y clínicos, incluidas las imágenes y los documentos de mi historia clínica, con fines de atención odontológica, seguimiento de mis tratamientos, facturación y comunicación de citas. Puedo solicitar el acceso, la rectificación o la eliminación de mis datos en cualquier momento."

export const attachmentKinds = ["fotografia", "radiografia", "consentimiento", "documento"] as const
export type AttachmentKind = (typeof attachmentKinds)[number]

export const attachmentKindLabels: Record<AttachmentKind, string> = {
  fotografia: "Fotografía",
  radiografia: "Radiografía",
  consentimiento: "Consentimiento",
  documento: "Documento",
}

export const allowedAttachmentTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const
export const maxAttachmentSize = 20 * 1024 * 1024

/** Estado completo del odontograma/periodontograma tal como lo exporta la librería. */
export interface ChartSnapshot {
  payload: Record<string, unknown>
  summary: OdontogramSummary
}

export interface DentalAttachment {
  id: string
  name: string
  kind: AttachmentKind
  mime: string
  size: number
  createdAt: string
}

/** Fecha local en formato YYYY-MM-DD (no UTC, para no adelantar el día en América). */
export function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

const minText = (message: string) => z.string().refine((value) => value.trim().length >= 3, message)

export const proposedTreatmentSchema = z.object({
  id: z.string(),
  /** `null` solo en ítems de texto libre heredados de la primera versión del módulo. */
  treatmentId: z.string().nullable(),
  description: z.string(),
  tooth: z.string().max(60, "Máximo 60 caracteres"),
})

/** Tratamiento propuesto al paciente; vive en la historia hasta que se registra en una atención. */
export type ProposedTreatment = z.infer<typeof proposedTreatmentSchema>

export const proposedTreatmentFormSchema = z.object({
  treatmentId: z.string().min(1, "Selecciona un tratamiento del catálogo"),
  tooth: z.string().max(60, "Máximo 60 caracteres"),
})

export type ProposedTreatmentFormValues = z.infer<typeof proposedTreatmentFormSchema>

export const dataConsentSchema = z
  .object({
    status: z.enum(dataConsentStatuses),
    signer: z.enum(dataConsentSigners),
    signerName: z.string(),
    signerDocumentId: z.string(),
    date: z.string(),
    /** Documento firmado, adjunto en «Fotos y documentos». */
    attachmentId: z.string().nullable(),
  })
  .superRefine((consent, ctx) => {
    if (consent.status === "pendiente") return
    if (consent.signerName.trim().length < 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["signerName"], message: "Indica el nombre de quien firma" })
    }
    if (consent.signerDocumentId.trim().length < 5) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["signerDocumentId"], message: "Indica la cédula de quien firma" })
    }
    if (!consent.date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "Indica la fecha de la decisión" })
    } else if (consent.date > today()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "La fecha no puede ser futura" })
    }
  })

/** Consentimiento de almacenamiento y tratamiento de datos personales y clínicos (uno por paciente). */
export type DataConsent = z.infer<typeof dataConsentSchema>

export const emptyDataConsent: DataConsent = {
  status: "pendiente",
  signer: "paciente",
  signerName: "",
  signerDocumentId: "",
  date: "",
  attachmentId: null,
}

/** Todo lo editable de la historia clínica. Se guarda con «Guardar cambios», previa confirmación. */
export const recordFormSchema = z.object({
  chart: z.custom<ChartSnapshot | null>((value) => value === null || typeof value === "object"),
  plan: z.array(proposedTreatmentSchema),
  dataConsent: dataConsentSchema,
  attachments: z.array(z.custom<DentalAttachment>()),
})

export type RecordFormValues = z.infer<typeof recordFormSchema>

/** Historia clínica de un paciente: estado actual, siempre editable. */
export interface ClinicalRecord extends RecordFormValues {
  patientId: string
  /** Control de concurrencia optimista: cada guardado debe enviar la revisión que leyó. */
  revision: number
  createdAt: string
  updatedAt: string
}

export const performedTreatmentSchema = z.object({
  id: z.string(),
  /** `null` solo en tratamientos de texto libre heredados de la primera versión del módulo. */
  treatmentId: z.string().nullable(),
  description: z.string(),
  tooth: z.string().max(60, "Máximo 60 caracteres"),
  /** Precio del catálogo al momento de la atención. */
  cost: z.number().min(0),
  /** Registro del tratamiento en el módulo Tratamientos. */
  assignmentId: z.string().nullable(),
})

export type PerformedTreatment = z.infer<typeof performedTreatmentSchema>

export const encounterFormSchema = z
  .object({
    date: z
      .string()
      .min(1, "La fecha es obligatoria")
      .refine((value) => value <= today(), "La fecha de la atención no puede ser futura"),
    professionalId: z.string().min(1, "Selecciona un profesional"),
    appointmentId: z.string().nullable(),
    reason: minText("Describe el motivo de consulta"),
    diagnosis: minText("Registra el diagnóstico"),
    procedures: z.string(),
    evolution: z.string(),
    notes: z.string(),
    nextVisit: z.string(),
    performedTreatments: z.array(performedTreatmentSchema),
  })
  .refine((encounter) => !encounter.nextVisit || encounter.nextVisit >= encounter.date, {
    message: "El próximo control debe ser igual o posterior a la fecha de la atención",
    path: ["nextVisit"],
  })

export type EncounterFormValues = z.infer<typeof encounterFormSchema>

/** Nota aclaratoria agregada a una atención ya guardada. No se edita ni se elimina. */
export interface EncounterNote {
  id: string
  text: string
  authorName: string
  createdAt: string
}

export const encounterNoteSchema = z.object({
  text: z.string().refine((value) => value.trim().length >= 10, "Escribe la nota (mínimo 10 caracteres)"),
})

export type EncounterNoteFormValues = z.infer<typeof encounterNoteSchema>

/** Atención registrada al paciente. Es inmutable: solo se le agregan notas aclaratorias. */
export interface ClinicalEncounter extends EncounterFormValues {
  id: string
  patientId: string
  /** Copia del odontograma de la historia en el momento de guardar la atención. */
  chartSnapshot: ChartSnapshot | null
  addenda: EncounterNote[]
  /** Nombre en texto libre de la primera versión del módulo, conservado al migrar. */
  legacyProfessionalName?: string
  createdAt: string
}

/** Historia clínica completa de un paciente, con las atenciones de la más antigua a la más reciente. */
export interface PatientClinicalHistory {
  record: ClinicalRecord
  encounters: ClinicalEncounter[]
}

export type EncounterListItem = Pick<
  ClinicalEncounter,
  "id" | "patientId" | "date" | "professionalId" | "legacyProfessionalName" | "reason" | "diagnosis" | "nextVisit"
>

export interface EncounterListQuery extends PageQuery {
  patientId?: string
  professionalId?: string
}

export interface CreateEncounterInput extends EncounterFormValues {
  /** Generado en el frontend antes de registrar los tratamientos, para que un reintento no duplique nada. */
  id: string
  chartSnapshot: ChartSnapshot | null
}

export interface AddEncounterNoteInput {
  text: string
  /** Solo para el modo demostración; el backend toma el autor de la sesión. */
  authorName: string
}

export interface UploadAttachmentInput {
  patientId: string
  file: File
  kind: AttachmentKind
}
