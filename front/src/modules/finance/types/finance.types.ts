import { z } from "zod"

export const paymentMethods = ["efectivo", "transferencia", "tarjeta_debito", "tarjeta_credito", "deposito", "cheque", "otros"] as const

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta_debito: "Tarjeta de débito",
  tarjeta_credito: "Tarjeta de crédito",
  deposito: "Depósito",
  cheque: "Cheque",
  otros: "Otros",
}

export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "tarjeta_debito"
  | "tarjeta_credito"
  | "deposito"
  | "cheque"
  | "otros"

/** `reversado` no lo usa la API (etapa B, ítem 8): queda sin uso. */
export type PaymentStatus = "registrado" | "anulado" | "reversado"

export type InstallmentStatus =
  | "pendiente"
  | "parcial"
  | "pagada"
  | "vencida"
  | "cancelada"

export type InvoiceStatus = "borrador" | "emitida" | "autorizada" | "anulada"

export interface FinancialPayment {
  id: string
  patientId: string
  treatmentId: string
  date: string
  amount: number
  method: PaymentMethod
  reference: string
  registeredBy: string
  observations: string
  status: PaymentStatus
  /** Motivo de la anulación. */
  voidReason?: string
}

/** Los mismos límites que `PaymentRequest` de la API. */
export const paymentSchema = z.object({
  patientId: z.string().min(1),
  treatmentId: z.string().min(1),
  date: z.string().min(1, "La fecha es obligatoria").refine((value) => value <= new Date().toLocaleDateString("en-CA"), "La fecha no puede ser futura"),
  amount: z.coerce.number().min(0.01, "Mínimo 0,01"),
  method: z.enum(paymentMethods, { message: "Selecciona un método" }),
  reference: z.string().max(100, "Máximo 100 caracteres").optional(),
  observations: z.string().max(500, "Máximo 500 caracteres").optional(),
})
export type PaymentFormValues = z.infer<typeof paymentSchema>

export const voidPaymentSchema = z.object({
  reason: z.string().trim().min(3, "Mínimo 3 caracteres").max(300, "Máximo 300 caracteres"),
})
export type VoidPaymentFormValues = z.infer<typeof voidPaymentSchema>

export interface Installment {
  id: string
  patientId: string
  treatmentId: string
  number: number
  dueDate: string
  amount: number
  paid: number
  balance: number
  paymentDate?: string
  status: InstallmentStatus
  daysLate: number
}

export interface InsuranceCoverage {
  id: string
  patientId: string
  treatmentId: string
  insurer: string
  policyNumber: string
  authorizationNumber: string
  coveragePercent: number
  coveredValue: number
  copay: number
  deductible: number
  outstandingInsurance: number
  outstandingPatient: number
}

export interface Invoice {
  id: string
  patientId: string
  treatmentId: string
  number: string
  establishment: string
  emissionPoint: string
  sequence: string
  issueDate: string
  accessKey: string
  subtotal: number
  tax: number
  discount: number
  total: number
  status: InvoiceStatus
  authorizationNumber?: string
  authorizedAt?: string
  xml?: string
  authorizedXml?: string
  ride?: string
}

export interface FinancialSummary {
  treatmentId: string
  patientId: string
  treatmentName: string
  totalValue: number
  totalPaid: number
  pendingBalance: number
  overdueBalance: number
  insuranceCovered: number
  patientResponsibility: number
  nextDueDate: string | null
  payments: FinancialPayment[]
  installments: Installment[]
  insurance: InsuranceCoverage | null
  invoice: Invoice | null
}

export interface FinancialPortfolioRow {
  patientId: string
  patientName: string
  treatmentId: string
  treatmentName: string
  total: number
  paid: number
  pending: number
  overdue: number
  nextDueDate: string | null
  daysLate: number
  status: "al_dia" | "parcial" | "vencida"
}

export interface PatientFinancialSummary {
  patientId: string
  totalTreatments: number
  totalPaid: number
  totalPending: number
  totalOverdue: number
  nextDueDate: string | null
  paymentCount: number
}
