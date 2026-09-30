import { z } from "zod"
import type { OdontogramSummary } from "react-advanced-odontogram"

import type { PageQuery } from "@/shared/types/common"

export const visitStatuses = ["borrador", "cerrada"] as const
export type VisitStatus = (typeof visitStatuses)[number]

export const visitStatusLabels: Record<VisitStatus, string> = {
  borrador: "Borrador",
  cerrada: "Cerrada",
}

/** Las claves se conservan desde la primera versión del módulo para no remapear datos guardados. */
export const planItemStatuses = ["pendiente", "en-curso", "realizado", "cancelado"] as const
export type PlanItemStatus = (typeof planItemStatuses)[number]

export const planItemStatusLabels: Record<PlanItemStatus, string> = {
  pendiente: "Propuesto",
  "en-curso": "Aprobado · en curso",
  realizado: "Realizado en esta visita",
  cancelado: "Descartado",
}

/** Estados que, al cerrar la visita, crean una asignación de tratamiento para el paciente. */
export const assignablePlanStatuses: readonly PlanItemStatus[] = ["en-curso", "realizado"]

export const consentStatuses = ["pendiente", "firmado", "rechazado"] as const
export type ConsentStatus = (typeof consentStatuses)[number]

export const consentStatusLabels: Record<ConsentStatus, string> = {
  pendiente: "Pendiente",
  firmado: "Firmado en documento",
  rechazado: "Rechazado",
}

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

export const planItemSchema = z
  .object({
    id: z.string(),
    /** `null` solo en ítems de texto libre heredados de la primera versión del módulo. */
    treatmentId: z.string().nullable(),
    description: z.string(),
    tooth: z.string().max(60, "Máximo 60 caracteres"),
    sessions: z.coerce.number().int().min(1, "Mínimo 1 sesión").max(60, "Máximo 60 sesiones"),
    status: z.enum(planItemStatuses),
    assignmentId: z.string().nullable(),
  })
  .superRefine((item, ctx) => {
    if (assignablePlanStatuses.includes(item.status) && !item.treatmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["treatmentId"],
        message: "Elige un tratamiento del catálogo para aprobarlo",
      })
    }
  })

export type PlanItem = z.infer<typeof planItemSchema>

export const planItemFormSchema = z.object({
  treatmentId: z.string().min(1, "Selecciona un tratamiento del catálogo"),
  tooth: z.string().max(60, "Máximo 60 caracteres"),
  sessions: z.coerce.number().int().min(1, "Mínimo 1 sesión").max(60, "Máximo 60 sesiones"),
  status: z.enum(["pendiente", "en-curso", "realizado"]),
})

export type PlanItemFormValues = z.infer<typeof planItemFormSchema>

export const consentSchema = z
  .object({
    id: z.string(),
    procedure: z.string(),
    information: z.string(),
    status: z.enum(consentStatuses),
    signer: z.string(),
    date: z.string(),
  })
  .superRefine((consent, ctx) => {
    if (consent.procedure.trim().length < 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["procedure"], message: "Indica el procedimiento autorizado" })
    }
    if (consent.information.trim().length < 10) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["information"], message: "Describe la información entregada (mínimo 10 caracteres)" })
    }
    if (consent.status !== "pendiente") {
      if (consent.signer.trim().length < 3) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["signer"], message: "Indica quién firmó o rechazó" })
      }
      if (!consent.date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "Indica la fecha de la decisión" })
      }
    }
  })

export type DentalConsent = z.infer<typeof consentSchema>

const minText = (message: string) => z.string().refine((value) => value.trim().length >= 3, message)

/**
 * Todo lo editable de una visita. Se usa con React Hook Form: el autoguardado del borrador
 * no valida; la validación completa corre solo al cerrar la visita.
 */
export const visitFormSchema = z
  .object({
    date: z.string().min(1, "La fecha es obligatoria"),
    professionalId: z.string().min(1, "Selecciona un profesional"),
    appointmentId: z.string().nullable(),
    reason: minText("Describe el motivo de consulta"),
    diagnosis: minText("Registra el diagnóstico"),
    procedures: z.string(),
    evolution: z.string(),
    notes: z.string(),
    nextVisit: z.string(),
    chart: z.custom<ChartSnapshot | null>((value) => value === null || typeof value === "object"),
    plan: z.array(planItemSchema),
    consents: z.array(consentSchema),
    attachments: z.array(z.custom<DentalAttachment>()),
  })
  .refine((visit) => !visit.nextVisit || visit.nextVisit >= visit.date, {
    message: "El próximo control debe ser igual o posterior a la fecha de consulta",
    path: ["nextVisit"],
  })
  .refine((visit) => visit.chart !== null, {
    message: "Registra el odontograma antes de cerrar la visita",
    path: ["chart"],
  })

export type VisitFormValues = z.infer<typeof visitFormSchema>

export interface DentalVisit extends VisitFormValues {
  id: string
  patientId: string
  status: VisitStatus
  /** Control de concurrencia optimista: cada guardado debe enviar la revisión que leyó. */
  revision: number
  /** Nombre en texto libre de la primera versión del módulo, conservado al migrar. */
  legacyProfessionalName?: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

/** Historia clínica completa de un paciente, con las visitas ordenadas de la más antigua a la más reciente. */
export interface DentalRecord {
  patientId: string
  visits: DentalVisit[]
}

export type VisitListItem = Pick<
  DentalVisit,
  | "id"
  | "patientId"
  | "status"
  | "date"
  | "professionalId"
  | "legacyProfessionalName"
  | "reason"
  | "diagnosis"
  | "nextVisit"
  | "closedAt"
>

export interface VisitListQuery extends PageQuery {
  patientId?: string
  professionalId?: string
  status?: VisitStatus
}

export const startVisitSchema = z.object({
  professionalId: z.string().min(1, "Selecciona un profesional"),
  appointmentId: z.string().nullable(),
  date: z.string().min(1, "La fecha es obligatoria"),
})

export type StartVisitInput = z.infer<typeof startVisitSchema>

export interface UploadAttachmentInput {
  patientId: string
  file: File
  kind: AttachmentKind
}

export interface CloseVisitResult {
  visit: DentalVisit
  createdAssignmentIds: string[]
  appointmentCompleted: boolean
  warnings: string[]
}
