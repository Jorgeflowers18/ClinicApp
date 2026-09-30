import { getPatientFinancialSummary, getTreatmentFinancialSummary, buildPortfolioRows } from "./finance.mock-data"

export const financeApi = {
  listPortfolio: async () => buildPortfolioRows(),
  getTreatmentSummary: async (treatmentId: string, patientId?: string) => getTreatmentFinancialSummary(treatmentId, patientId),
  getPatientSummary: async (patientId: string) => getPatientFinancialSummary(patientId),
}
