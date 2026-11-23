import { apiGet } from "@/shared/lib/http"

import type { ReportsApi } from "./reports.contract"
import type { AgendaReport, InventoryReport, ProductivityReport, ReportsSummary, TreatmentsReport } from "../types/report.types"

// El back se construyó con las formas de `report.types.ts`: no hace falta mapear.
export const httpReportsApi: ReportsApi = {
  getSummary: (period, signal) => apiGet<ReportsSummary>("/reports/summary", { params: period, signal }),
  getAgenda: (period, signal) => apiGet<AgendaReport>("/reports/agenda", { params: period, signal }),
  getProductivity: (period, signal) => apiGet<ProductivityReport>("/reports/productivity", { params: period, signal }),
  getTreatments: (period, signal) => apiGet<TreatmentsReport>("/reports/treatments", { params: period, signal }),
  getInventory: (period, signal) => apiGet<InventoryReport>("/reports/inventory", { params: period, signal }),
}
