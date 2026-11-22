import { mockDelay, nextId } from "@/shared/lib/mock"
import { ApiError } from "@/shared/types/common"
import { useAuthStore } from "@/modules/auth/store/auth-store"

import type { FinanceApi } from "./finance.contract"
import { buildPortfolioRows, getPatientFinancialSummary, getTreatmentFinancialSummary, mockFinancialPayments } from "./finance.mock-data"
import type { FinancialPayment } from "../types/finance.types"

/** Demostración: la cartera se recalcula en cada llamada desde los datos en memoria, como haría el servidor. */
export const mockFinanceApi: FinanceApi = {
  async listPortfolio() {
    await mockDelay(200)
    return buildPortfolioRows()
  },
  async getTreatmentSummary(treatmentId, patientId) {
    await mockDelay(150)
    return getTreatmentFinancialSummary(treatmentId, patientId)
  },
  async getPatientSummary(patientId) {
    await mockDelay(150)
    return getPatientFinancialSummary(patientId)
  },
  async registerPayment(values) {
    await mockDelay()
    const { pendingBalance } = getTreatmentFinancialSummary(values.treatmentId, values.patientId)
    if (values.amount > pendingBalance) {
      const message = `El pago supera el saldo pendiente (${pendingBalance})`
      throw new ApiError(message, 409, [{ field: "amount", message }])
    }
    const payment: FinancialPayment = {
      id: nextId("pay"),
      ...values,
      reference: values.reference ?? "",
      observations: values.observations ?? "",
      registeredBy: useAuthStore.getState().user?.name ?? "",
      status: "registrado",
    }
    mockFinancialPayments.push(payment)
    return payment
  },
  async voidPayment(paymentId, reason) {
    await mockDelay()
    const index = mockFinancialPayments.findIndex((payment) => payment.id === paymentId)
    if (index === -1) throw new ApiError("Pago no encontrado", 404)
    if (mockFinancialPayments[index].status !== "registrado") throw new ApiError("El pago ya está anulado", 409)
    mockFinancialPayments[index] = { ...mockFinancialPayments[index], status: "anulado", voidReason: reason }
    return mockFinancialPayments[index]
  },
}
