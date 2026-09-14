import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { reportsApi } from "./reports.api"
import type { ReportPeriod } from "../types/report.types"

export const reportsKeys = {
  all: ["reports"] as const,
  summary: (period: ReportPeriod) => [...reportsKeys.all, "summary", period] as const,
  agenda: (period: ReportPeriod) => [...reportsKeys.all, "agenda", period] as const,
  productivity: (period: ReportPeriod) => [...reportsKeys.all, "productivity", period] as const,
  treatments: (period: ReportPeriod) => [...reportsKeys.all, "treatments", period] as const,
  inventory: (period: ReportPeriod) => [...reportsKeys.all, "inventory", period] as const,
}

// Los reportes se recalculan al montar (`refetchOnMount: "always"`) en vez de invalidarse desde las
// mutaciones de otros módulos: la dependencia queda unidireccional (reports lee, nadie conoce a reports).
const reportQueryOptions = { placeholderData: keepPreviousData, refetchOnMount: "always" as const }

export function useReportsSummary(period: ReportPeriod) {
  return useQuery({
    queryKey: reportsKeys.summary(period),
    queryFn: () => reportsApi.getSummary(period),
    ...reportQueryOptions,
  })
}

export function useAgendaReport(period: ReportPeriod) {
  return useQuery({
    queryKey: reportsKeys.agenda(period),
    queryFn: () => reportsApi.getAgenda(period),
    ...reportQueryOptions,
  })
}

export function useProductivityReport(period: ReportPeriod) {
  return useQuery({
    queryKey: reportsKeys.productivity(period),
    queryFn: () => reportsApi.getProductivity(period),
    ...reportQueryOptions,
  })
}

export function useTreatmentsReport(period: ReportPeriod) {
  return useQuery({
    queryKey: reportsKeys.treatments(period),
    queryFn: () => reportsApi.getTreatments(period),
    ...reportQueryOptions,
  })
}

export function useInventoryReport(period: ReportPeriod) {
  return useQuery({
    queryKey: reportsKeys.inventory(period),
    queryFn: () => reportsApi.getInventory(period),
    ...reportQueryOptions,
  })
}
