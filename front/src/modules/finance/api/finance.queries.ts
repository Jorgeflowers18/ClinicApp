import { useQuery } from "@tanstack/react-query"

import { financeApi } from "./finance.api"

export const financeKeys = {
  all: ["finance"] as const,
  portfolio: ["finance", "portfolio"] as const,
  treatment: (treatmentId: string, patientId?: string) => [...financeKeys.all, "treatment", treatmentId, patientId ?? "all"] as const,
  patient: (patientId: string) => [...financeKeys.all, "patient", patientId] as const,
}

export function useFinancialPortfolio() {
  return useQuery({
    queryKey: financeKeys.portfolio,
    queryFn: financeApi.listPortfolio,
  })
}

export function useTreatmentFinancialSummary(treatmentId?: string, patientId?: string) {
  return useQuery({
    queryKey: financeKeys.treatment(treatmentId ?? "", patientId),
    queryFn: () => financeApi.getTreatmentSummary(treatmentId ?? "", patientId),
    enabled: Boolean(treatmentId),
  })
}

export function usePatientFinancialSummary(patientId?: string) {
  return useQuery({
    queryKey: financeKeys.patient(patientId ?? ""),
    queryFn: () => financeApi.getPatientSummary(patientId ?? ""),
    enabled: Boolean(patientId),
  })
}
