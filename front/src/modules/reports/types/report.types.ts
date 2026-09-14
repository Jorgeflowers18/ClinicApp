import type { AppointmentStatus } from "@/modules/appointments/types/appointment.types"
import type { PurchaseOrderStatus } from "@/modules/inventory/types/inventory.types"

export const reportPeriodPresets = ["week", "month", "last30", "year", "custom"] as const
export type ReportPeriodPreset = (typeof reportPeriodPresets)[number]

export const reportPeriodPresetLabels: Record<ReportPeriodPreset, string> = {
  week: "Esta semana",
  month: "Este mes",
  last30: "Últimos 30 días",
  year: "Este año",
  custom: "Personalizado",
}

/** Rango inclusivo en formato YYYY-MM-DD, interpretado en hora local. */
export interface ReportPeriod {
  from: string
  to: string
}

export interface ReportPeriodState {
  preset: ReportPeriodPreset
  period: ReportPeriod
}

/** `patientsTotal`, `activeTreatments` y `criticalStockItems` son puntuales; el resto filtra por periodo. */
export interface ReportsSummary {
  patientsTotal: number
  patientsNewInPeriod: number
  appointmentsInPeriod: number
  appointmentsCompleted: number
  appointmentsNoShow: number
  noShowRate: number
  activeTreatments: number
  criticalStockItems: number
  notificationsSent: number
}

export interface AgendaDayRow {
  date: string
  label: string
  total: number
  completadas: number
  noShow: number
  canceladas: number
}

export interface AgendaStatusRow {
  status: AppointmentStatus
  label: string
  count: number
}

export interface RoomOccupancyRow {
  roomId: string
  roomName: string
  appointments: number
  bookedMinutes: number
  blockedMinutes: number
}

export interface AgendaReport {
  byDay: AgendaDayRow[]
  byStatus: AgendaStatusRow[]
  occupancyByRoom: RoomOccupancyRow[]
}

export interface ProfessionalProductivityRow {
  professionalId: string
  name: string
  specialty: string
  scheduled: number
  completed: number
  noShow: number
  cancelled: number
  completionRate: number
}

export interface ProductivityReport {
  byProfessional: ProfessionalProductivityRow[]
}

export interface TreatmentReportRow {
  treatmentId: string
  name: string
  price: number
  appointmentsInPeriod: number
  activeAssignments: number
  completedAssignments: number
  sessionsDone: number
  sessionsPlanned: number
  /** precio × asignaciones completadas; provisional hasta que exista facturación. */
  estimatedRevenue: number
}

export interface TreatmentsReport {
  byTreatment: TreatmentReportRow[]
}

export interface CriticalItemRow {
  itemId: string
  name: string
  category: string
  stock: number
  minStock: number
  unit: string
}

export interface PurchaseReportRow {
  orderId: string
  supplierName: string
  status: PurchaseOrderStatus
  statusLabel: string
  total: number
  createdAt: string
}

export interface ConsumptionRow {
  itemId: string
  name: string
  unit: string
  quantity: number
}

export interface InventoryReport {
  criticalItems: CriticalItemRow[]
  purchasesInPeriod: PurchaseReportRow[]
  /** Excluye órdenes canceladas. */
  purchasesTotal: number
  consumptionInPeriod: ConsumptionRow[]
}
