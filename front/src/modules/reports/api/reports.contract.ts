import type { AgendaReport, InventoryReport, ProductivityReport, ReportPeriod, ReportsSummary, TreatmentsReport } from "../types/report.types"

/**
 * Reportes e indicadores del Inicio. `reports.http.ts` los pide a la API (agregados en PostgreSQL, por días de
 * la clínica). El periodo es obligatorio, inclusivo y de hasta 366 días (`400` si no).
 */
export interface ReportsApi {
  /** Los tres roles (lo usa el Inicio). */
  getSummary(period: ReportPeriod, signal?: AbortSignal): Promise<ReportsSummary>
  /** Los tres roles. */
  getAgenda(period: ReportPeriod, signal?: AbortSignal): Promise<AgendaReport>
  /** Solo admin. */
  getProductivity(period: ReportPeriod, signal?: AbortSignal): Promise<ProductivityReport>
  /** Solo admin. `estimatedRevenue` es provisional hasta la etapa B de finanzas. */
  getTreatments(period: ReportPeriod, signal?: AbortSignal): Promise<TreatmentsReport>
  /** Solo admin. */
  getInventory(period: ReportPeriod, signal?: AbortSignal): Promise<InventoryReport>
}
