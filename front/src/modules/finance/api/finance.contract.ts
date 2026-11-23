import type {
  FinancialPayment,
  FinancialPortfolioRow,
  FinancialSummary,
  PatientFinancialSummary,
  PaymentFormValues,
} from "../types/finance.types"

/**
 * Finanzas (etapa A: saldos y pagos, sin cuotas, seguros ni factura). `finance.http.ts` lo cumple con la API.
 * Solo admin y recepción: el médico recibe `403`, así que las pantallas no se lo piden.
 */
export interface FinanceApi {
  /** Una fila por paciente y tratamiento, de mayor a menor deuda (también las que están al día). */
  listPortfolio(signal?: AbortSignal): Promise<FinancialPortfolioRow[]>
  /** El resumen de un tratamiento de un paciente, con sus pagos. */
  getTreatmentSummary(treatmentId: string, patientId: string, signal?: AbortSignal): Promise<FinancialSummary>
  getPatientSummary(patientId: string, signal?: AbortSignal): Promise<PatientFinancialSummary>
  /** `409` en `errors.amount` si supera el saldo pendiente. */
  registerPayment(values: PaymentFormValues): Promise<FinancialPayment>
  /** `409` si ya está anulado. */
  voidPayment(paymentId: string, reason: string): Promise<FinancialPayment>
}
