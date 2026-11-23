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

/**
 * Finanzas cubre lo que la clínica registra hoy: el precio de cada tratamiento realizado, los pagos y lo pendiente.
 * Cuotas, vencimientos, mora, seguros y factura dependen del tipo de financiamiento de cada clínica (ítem 8 del
 * backlog): no se muestran. La API todavía los devuelve en 0 / `null` / vacíos, y estos tipos los ignoran.
 */
export type PaymentStatus = "registrado" | "anulado"


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

export interface FinancialSummary {
  treatmentId: string
  patientId: string
  treatmentName: string
  totalValue: number
  totalPaid: number
  pendingBalance: number
  payments: FinancialPayment[]
}

export interface FinancialPortfolioRow {
  patientId: string
  patientName: string
  treatmentId: string
  treatmentName: string
  total: number
  paid: number
  pending: number
  status: "al_dia" | "parcial"
}

export interface PatientFinancialSummary {
  patientId: string
  totalTreatments: number
  totalPaid: number
  totalPending: number
  paymentCount: number
}
