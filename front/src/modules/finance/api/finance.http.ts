import type { components } from "@/shared/api/schema"
import { apiGet, apiPost } from "@/shared/lib/http"

import type { FinanceApi } from "./finance.contract"
import type { FinancialPayment, FinancialPortfolioRow, FinancialSummary } from "../types/finance.types"

type Schemas = components["schemas"]

const toPayment = (dto: Schemas["FinancialPaymentDto"]): FinancialPayment => ({
  ...dto,
  method: dto.method as FinancialPayment["method"],
  status: dto.status as FinancialPayment["status"],
  voidReason: dto.voidReason ?? undefined,
})

// La API también trae vencido, próximo vencimiento, mora, cuotas, seguro y factura (siempre en 0 o vacíos):
// no se leen. Dependen del financiamiento de cada clínica (ítem 8 del backlog).
const toRow = (dto: Schemas["FinancialPortfolioRowDto"]): FinancialPortfolioRow => ({
  patientId: dto.patientId,
  patientName: dto.patientName,
  treatmentId: dto.treatmentId,
  treatmentName: dto.treatmentName,
  total: dto.total,
  paid: dto.paid,
  pending: dto.pending,
  status: dto.status === "al_dia" ? "al_dia" : "parcial",
})

const toSummary = (dto: Schemas["FinancialSummaryDto"]): FinancialSummary => ({
  treatmentId: dto.treatmentId,
  patientId: dto.patientId ?? "",
  treatmentName: dto.treatmentName,
  totalValue: dto.totalValue,
  totalPaid: dto.totalPaid,
  pendingBalance: dto.pendingBalance,
  payments: dto.payments.map(toPayment),
})

export const httpFinanceApi: FinanceApi = {
  async listPortfolio(signal) {
    return (await apiGet<Schemas["FinancialPortfolioRowDto"][]>("/finance/portfolio", { signal })).map(toRow)
  },
  async getTreatmentSummary(treatmentId, patientId, signal) {
    return toSummary(await apiGet<Schemas["FinancialSummaryDto"]>(`/finance/treatments/${treatmentId}/summary`, { params: { patientId }, signal }))
  },
  async getPatientSummary(patientId, signal) {
    const dto = await apiGet<Schemas["PatientFinancialSummaryDto"]>(`/finance/patients/${patientId}/summary`, { signal })
    return { patientId: dto.patientId, totalTreatments: dto.totalTreatments, totalPaid: dto.totalPaid, totalPending: dto.totalPending, paymentCount: dto.paymentCount }
  },
  async registerPayment(values) {
    const body: Schemas["PaymentRequest"] = { ...values, reference: values.reference || null, observations: values.observations || null }
    return toPayment(await apiPost<Schemas["FinancialPaymentDto"]>("/finance/payments", body))
  },
  async voidPayment(paymentId, reason) {
    return toPayment(await apiPost<Schemas["FinancialPaymentDto"]>(`/finance/payments/${paymentId}/void`, { reason }))
  },
}
