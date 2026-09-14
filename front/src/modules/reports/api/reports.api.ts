/**
 * Este módulo no tiene datos propios (no existe `reports.mock-data.ts`): toda la reportería se
 * deriva en memoria, en modo solo lectura, de los `mock*` de los demás módulos — mismo precedente
 * que `notifications.api.ts` leyendo `mockPatients`. Con backend real la agregación es SQL del
 * lado del servidor (endpoints `GET /reports/*`), no del navegador.
 */
import { differenceInMinutes, eachDayOfInterval, format } from "date-fns"
import { es } from "date-fns/locale"

import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { mockDelay } from "@/shared/lib/mock"
import {
  mockAppointments,
  mockProfessionals,
  mockRooms,
  mockScheduleBlocks,
} from "@/modules/appointments/api/appointments.mock-data"
import { appointmentStatuses, appointmentStatusLabels } from "@/modules/appointments/types/appointment.types"
import { mockTreatmentAssignments, mockTreatments } from "@/modules/treatments/api/treatments.mock-data"
import {
  mockInventoryItems,
  mockPurchaseOrders,
  mockStockMovements,
  mockSuppliers,
} from "@/modules/inventory/api/inventory.mock-data"
import { purchaseOrderStatusLabels } from "@/modules/inventory/types/inventory.types"
import { mockPatients } from "@/modules/patients/api/patients.mock-data"
import { mockNotifications } from "@/modules/notifications/api/notifications.mock-data"

import { isDateOnlyWithinPeriod, isWithinPeriod, periodToInterval } from "../lib/period"
import type {
  AgendaReport,
  InventoryReport,
  ProductivityReport,
  ReportPeriod,
  ReportsSummary,
  TreatmentsReport,
} from "../types/report.types"

function appointmentsIn(period: ReportPeriod) {
  return mockAppointments.filter((appointment) => isWithinPeriod(appointment.start, period))
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0
}

async function getSummaryMock(period: ReportPeriod): Promise<ReportsSummary> {
  await mockDelay(300)
  const appointments = appointmentsIn(period)
  const completed = appointments.filter((item) => item.status === "completada").length
  const noShow = appointments.filter((item) => item.status === "no_asistio").length

  return {
    patientsTotal: mockPatients.length,
    patientsNewInPeriod: mockPatients.filter((patient) => isWithinPeriod(patient.createdAt, period)).length,
    appointmentsInPeriod: appointments.length,
    appointmentsCompleted: completed,
    appointmentsNoShow: noShow,
    noShowRate: ratio(noShow, completed + noShow),
    activeTreatments: mockTreatmentAssignments.filter((item) => item.status === "en_progreso").length,
    criticalStockItems: mockInventoryItems.filter((item) => item.stock <= item.minStock).length,
    notificationsSent: mockNotifications.filter(
      (log) => log.status === "enviada" && isWithinPeriod(log.sentAt, period)
    ).length,
  }
}

async function getAgendaMock(period: ReportPeriod): Promise<AgendaReport> {
  await mockDelay(300)
  const appointments = appointmentsIn(period)
  const { start, end } = periodToInterval(period)

  const byDay = eachDayOfInterval({ start, end }).map((day) => {
    const key = format(day, "yyyy-MM-dd")
    const ofDay = appointments.filter((item) => format(new Date(item.start), "yyyy-MM-dd") === key)
    return {
      date: key,
      label: format(day, "EEE d", { locale: es }),
      total: ofDay.length,
      completadas: ofDay.filter((item) => item.status === "completada").length,
      noShow: ofDay.filter((item) => item.status === "no_asistio").length,
      canceladas: ofDay.filter((item) => item.status === "cancelada").length,
    }
  })

  const byStatus = appointmentStatuses.map((status) => ({
    status,
    label: appointmentStatusLabels[status],
    count: appointments.filter((item) => item.status === status).length,
  }))

  const minutes = (item: { start: string; end: string }) => differenceInMinutes(new Date(item.end), new Date(item.start))
  const active = appointments.filter((item) => item.status !== "cancelada")
  const blocks = mockScheduleBlocks.filter((block) => isWithinPeriod(block.start, period))

  const occupancyByRoom = mockRooms.map((room) => {
    const ofRoom = active.filter((item) => item.roomId === room.id)
    return {
      roomId: room.id,
      roomName: room.name,
      appointments: ofRoom.length,
      bookedMinutes: ofRoom.reduce((sum, item) => sum + minutes(item), 0),
      blockedMinutes: blocks.filter((block) => block.roomId === room.id).reduce((sum, block) => sum + minutes(block), 0),
    }
  })

  const withoutRoom = active.filter((item) => !item.roomId)
  if (withoutRoom.length > 0) {
    occupancyByRoom.push({
      roomId: "",
      roomName: "Sin consultorio",
      appointments: withoutRoom.length,
      bookedMinutes: withoutRoom.reduce((sum, item) => sum + minutes(item), 0),
      blockedMinutes: 0,
    })
  }

  return { byDay, byStatus, occupancyByRoom }
}

async function getProductivityMock(period: ReportPeriod): Promise<ProductivityReport> {
  await mockDelay(300)
  const appointments = appointmentsIn(period)

  const byProfessional = mockProfessionals
    .map((professional) => {
      const own = appointments.filter((item) => item.professionalId === professional.id)
      const completed = own.filter((item) => item.status === "completada").length
      const cancelled = own.filter((item) => item.status === "cancelada").length
      return {
        professionalId: professional.id,
        name: professional.name,
        specialty: professional.specialty,
        scheduled: own.length,
        completed,
        noShow: own.filter((item) => item.status === "no_asistio").length,
        cancelled,
        completionRate: ratio(completed, Math.max(1, own.length - cancelled)),
      }
    })
    .sort((a, b) => b.completed - a.completed)

  return { byProfessional }
}

async function getTreatmentsMock(period: ReportPeriod): Promise<TreatmentsReport> {
  await mockDelay(300)
  const appointments = appointmentsIn(period)
  const assignments = mockTreatmentAssignments.filter((item) => isDateOnlyWithinPeriod(item.startDate, period))

  const byTreatment = mockTreatments.map((treatment) => {
    const own = assignments.filter((item) => item.treatmentId === treatment.id)
    const completedAssignments = own.filter((item) => item.status === "completado").length
    return {
      treatmentId: treatment.id,
      name: treatment.name,
      price: treatment.price,
      appointmentsInPeriod: appointments.filter((item) => item.treatmentId === treatment.id).length,
      activeAssignments: own.filter((item) => item.status === "en_progreso").length,
      completedAssignments,
      sessionsDone: own.reduce((sum, item) => sum + item.completedSessions, 0),
      sessionsPlanned: own.reduce((sum, item) => sum + item.totalSessions, 0),
      estimatedRevenue: treatment.price * completedAssignments,
    }
  })

  return { byTreatment }
}

async function getInventoryMock(period: ReportPeriod): Promise<InventoryReport> {
  await mockDelay(300)

  const criticalItems = mockInventoryItems
    .filter((item) => item.stock <= item.minStock)
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      category: item.category,
      stock: item.stock,
      minStock: item.minStock,
      unit: item.unit,
    }))

  const purchasesInPeriod = mockPurchaseOrders
    .filter((order) => isWithinPeriod(order.createdAt, period))
    .map((order) => ({
      orderId: order.id,
      supplierName: mockSuppliers.find((supplier) => supplier.id === order.supplierId)?.name ?? "Proveedor",
      status: order.status,
      statusLabel: purchaseOrderStatusLabels[order.status],
      total: order.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
      createdAt: order.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const purchasesTotal = purchasesInPeriod
    .filter((order) => order.status !== "cancelada")
    .reduce((sum, order) => sum + order.total, 0)

  const consumed = new Map<string, number>()
  for (const movement of mockStockMovements) {
    if (movement.type !== "salida" || !isWithinPeriod(movement.createdAt, period)) continue
    consumed.set(movement.itemId, (consumed.get(movement.itemId) ?? 0) + movement.quantity)
  }
  const consumptionInPeriod = [...consumed.entries()]
    .map(([itemId, quantity]) => {
      const item = mockInventoryItems.find((entry) => entry.id === itemId)
      return { itemId, name: item?.name ?? "Insumo", unit: item?.unit ?? "", quantity }
    })
    .sort((a, b) => b.quantity - a.quantity)

  return { criticalItems, purchasesInPeriod, purchasesTotal, consumptionInPeriod }
}

// TODO: conectar a endpoint real -> GET /reports/summary?from&to (agregación SQL del lado del servidor)
async function getSummaryReal(period: ReportPeriod): Promise<ReportsSummary> {
  const { data } = await http.get<ReportsSummary>("/reports/summary", { params: period })
  return data
}

// TODO: conectar a endpoint real -> GET /reports/agenda?from&to
async function getAgendaReal(period: ReportPeriod): Promise<AgendaReport> {
  const { data } = await http.get<AgendaReport>("/reports/agenda", { params: period })
  return data
}

// TODO: conectar a endpoint real -> GET /reports/productivity?from&to
async function getProductivityReal(period: ReportPeriod): Promise<ProductivityReport> {
  const { data } = await http.get<ProductivityReport>("/reports/productivity", { params: period })
  return data
}

// TODO: conectar a endpoint real -> GET /reports/treatments?from&to
async function getTreatmentsReal(period: ReportPeriod): Promise<TreatmentsReport> {
  const { data } = await http.get<TreatmentsReport>("/reports/treatments", { params: period })
  return data
}

// TODO: conectar a endpoint real -> GET /reports/inventory?from&to
async function getInventoryReal(period: ReportPeriod): Promise<InventoryReport> {
  const { data } = await http.get<InventoryReport>("/reports/inventory", { params: period })
  return data
}

export const reportsApi = {
  getSummary: env.useMockApi ? getSummaryMock : getSummaryReal,
  getAgenda: env.useMockApi ? getAgendaMock : getAgendaReal,
  getProductivity: env.useMockApi ? getProductivityMock : getProductivityReal,
  getTreatments: env.useMockApi ? getTreatmentsMock : getTreatmentsReal,
  getInventory: env.useMockApi ? getInventoryMock : getInventoryReal,
}
