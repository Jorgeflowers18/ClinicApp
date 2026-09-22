export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "tarjeta_debito"
  | "tarjeta_credito"
  | "deposito"
  | "cheque"
  | "otros"

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
}

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
