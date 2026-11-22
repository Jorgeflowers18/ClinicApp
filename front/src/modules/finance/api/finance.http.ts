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

const toRow = (dto: Schemas["FinancialPortfolioRowDto"]): FinancialPortfolioRow => ({ ...dto, status: dto.status as FinancialPortfolioRow["status"] })

// Etapa A: el back responde cuotas vacías y sin seguro ni factura.
const toSummary = (dto: Schemas["FinancialSummaryDto"]): FinancialSummary => ({
  ...dto,
  patientId: dto.patientId ?? "",
  payments: dto.payments.map(toPayment),
  installments: [],
  insurance: null,
  invoice: null,
})

export const httpFinanceApi: FinanceApi = {
  async listPortfolio(signal) {
    return (await apiGet<Schemas["FinancialPortfolioRowDto"][]>("/finance/portfolio", { signal })).map(toRow)
  },
  async getTreatmentSummary(treatmentId, patientId, signal) {
    return toSummary(await apiGet<Schemas["FinancialSummaryDto"]>(`/finance/treatments/${treatmentId}/summary`, { params: { patientId }, signal }))
  },
  async getPatientSummary(patientId, signal) {
    return apiGet<Schemas["PatientFinancialSummaryDto"]>(`/finance/patients/${patientId}/summary`, { signal })
  },
  async registerPayment(values) {
    const body: Schemas["PaymentRequest"] = { ...values, reference: values.reference || null, observations: values.observations || null }
    return toPayment(await apiPost<Schemas["FinancialPaymentDto"]>("/finance/payments", body))
  },
  async voidPayment(paymentId, reason) {
    return toPayment(await apiPost<Schemas["FinancialPaymentDto"]>(`/finance/payments/${paymentId}/void`, { reason }))
  },
}
