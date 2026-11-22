import { useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"

import { financeApi } from "./finance.api"
import type { PaymentFormValues } from "../types/finance.types"

export const financeKeys = {
  all: ["finance"] as const,
  portfolio: ["finance", "portfolio"] as const,
  treatment: (treatmentId: string, patientId: string) => [...financeKeys.all, "treatment", treatmentId, patientId] as const,
  patient: (patientId: string) => [...financeKeys.all, "patient", patientId] as const,
}

/** Finanzas es solo de admin y recepción (el médico recibe 403): quien llama decide con `enabled`. */
export function useFinancialPortfolio(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: financeKeys.portfolio,
    queryFn: ({ signal }) => financeApi.listPortfolio(signal),
    ...options,
  })
}

/** Total, pagado y pendiente de un tratamiento, sumando las filas de la cartera de todos sus pacientes. */
export function useTreatmentPortfolio(treatmentId: string | undefined, options: { enabled?: boolean } = {}) {
  const portfolio = useFinancialPortfolio({ enabled: Boolean(treatmentId) && (options.enabled ?? true) })
  const rows = (portfolio.data ?? []).filter((row) => row.treatmentId === treatmentId)
  const data = portfolio.data ? {
    total: rows.reduce((sum, row) => sum + row.total, 0),
    paid: rows.reduce((sum, row) => sum + row.paid, 0),
    pending: rows.reduce((sum, row) => sum + row.pending, 0),
    patients: rows.length,
  } : undefined
  return { ...portfolio, data }
}

export function useTreatmentFinancialSummary(treatmentId: string, patientId: string) {
  return useQuery({
    queryKey: financeKeys.treatment(treatmentId, patientId),
    queryFn: ({ signal }) => financeApi.getTreatmentSummary(treatmentId, patientId, signal),
    enabled: Boolean(treatmentId && patientId),
  })
}

export function usePatientFinancialSummary(patientId?: string) {
  return useQuery({
    queryKey: financeKeys.patient(patientId ?? ""),
    queryFn: ({ signal }) => financeApi.getPatientSummary(patientId ?? "", signal),
    enabled: Boolean(patientId),
  })
}

export function useRegisterPayment() {
  return useMutation({
    mutationFn: (values: PaymentFormValues) => financeApi.registerPayment(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

export function useVoidPayment() {
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => financeApi.voidPayment(paymentId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.all }),
  })
}
