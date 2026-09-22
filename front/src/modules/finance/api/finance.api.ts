import { getPatientFinancialSummary, getTreatmentFinancialSummary, mockPortfolioRows } from "./finance.mock-data"

export const financeApi = {
  listPortfolio: async () => mockPortfolioRows,
  getTreatmentSummary: async (treatmentId: string, patientId?: string) => getTreatmentFinancialSummary(treatmentId, patientId),
  getPatientSummary: async (patientId: string) => getPatientFinancialSummary(patientId),
}
