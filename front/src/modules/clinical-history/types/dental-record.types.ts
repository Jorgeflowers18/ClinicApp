import type { OdontogramSummary } from "react-advanced-odontogram"

export interface ChartSnapshot {
  payload: Record<string, unknown>
  summary: OdontogramSummary
}

export type TreatmentStage = "pendiente" | "en-curso" | "realizado" | "cancelado"
export interface DentalTreatment {
  id: string
  tooth: string
  description: string
  status: TreatmentStage
}

export interface DentalConsent {
  id: string
  procedure: string
  information: string
  status: "pendiente" | "firmado" | "rechazado"
  signer: string
  date: string
}

export type AttachmentKind = "fotografia" | "radiografia" | "consentimiento" | "documento"
export interface DentalAttachment {
  id: string
  name: string
  kind: AttachmentKind
  mime: string
  size: number
  createdAt: string
}

export interface DentalVisit {
  id: string
  date: string
  professional: string
  reason: string
  diagnosis: string
  procedures: string
  evolution: string
  notes: string
  nextVisit: string
  chart: ChartSnapshot | null
  plan: DentalTreatment[]
  consents: DentalConsent[]
  attachments: DentalAttachment[]
  savedAt: string | null
}

export interface DentalRecord {
  version: 1
  patientId: string
  revision: number
  draft: DentalVisit | null
  visits: DentalVisit[]
}

export const attachmentLabels: Record<AttachmentKind, string> = {
  fotografia: "Fotografía", radiografia: "Radiografía", consentimiento: "Consentimiento", documento: "Documento",
}
export const treatmentLabels: Record<TreatmentStage, string> = {
  pendiente: "Pendiente", "en-curso": "En curso", realizado: "Realizado", cancelado: "Cancelado",
}

export function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function newVisit(professional: string, previous?: DentalVisit): DentalVisit {
  return {
    id: crypto.randomUUID(), date: today(), professional, reason: "", diagnosis: "",
    procedures: "", evolution: "", notes: "", nextVisit: "", savedAt: null,
    chart: previous?.chart ? structuredClone(previous.chart) : null,
    plan: previous ? structuredClone(previous.plan.filter((item) => item.status !== "cancelado" && item.status !== "realizado")) : [],
    consents: [], attachments: [],
  }
}
