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
    queryFn: ({ signal }) => reportsApi.getSummary(period, signal),
    ...reportQueryOptions,
  })
}

export function useAgendaReport(period: ReportPeriod) {
  return useQuery({
    queryKey: reportsKeys.agenda(period),
    queryFn: ({ signal }) => reportsApi.getAgenda(period, signal),
    ...reportQueryOptions,
  })
}

export function useProductivityReport(period: ReportPeriod) {
  return useQuery({
    queryKey: reportsKeys.productivity(period),
    queryFn: ({ signal }) => reportsApi.getProductivity(period, signal),
    ...reportQueryOptions,
  })
}

export function useTreatmentsReport(period: ReportPeriod) {
  return useQuery({
    queryKey: reportsKeys.treatments(period),
    queryFn: ({ signal }) => reportsApi.getTreatments(period, signal),
    ...reportQueryOptions,
  })
}

export function useInventoryReport(period: ReportPeriod) {
  return useQuery({
    queryKey: reportsKeys.inventory(period),
    queryFn: ({ signal }) => reportsApi.getInventory(period, signal),
    ...reportQueryOptions,
  })
}
