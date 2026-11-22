import { mockDelay, nextId } from "@/shared/lib/mock"
import { ApiError } from "@/shared/types/common"
import { logMockAppointmentEvent } from "@/modules/notifications/api/notifications.mock"

import type { AgendaCatalogsApi, AppointmentsApi, DateRange } from "./appointments.contract"
import { mockAppointments, mockProfessionals, mockRooms, mockScheduleBlocks } from "./appointments.mock-data"
import type { Appointment } from "../types/appointment.types"

// Demostración: lo que con la API hace el servidor (choques, notificaciones y conversión de hora).

function toIsoRange(values: { date: string; startTime: string; endTime: string }) {
  return {
    start: new Date(`${values.date}T${values.startTime}`).toISOString(),
    end: new Date(`${values.date}T${values.endTime}`).toISOString(),
  }
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(aEnd).getTime() > new Date(bStart).getTime()
}

/** El día (en hora del navegador) en que empieza algo, para filtrar por rango como el servidor. */
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA")
const inRange = (iso: string, range?: DateRange) => !range || (dayOf(iso) >= range.from && dayOf(iso) <= range.to)

interface AppointmentConflictInput {
  professionalId: string
  roomId?: string
  start: string
  end: string
  excludeAppointmentId?: string
}

/** Valida disponibilidad de profesional y consultorio para una cita: otras citas + bloqueos de horario. */
function findAppointmentConflict(input: AppointmentConflictInput): string | null {
  const busy = (match: (appointment: Appointment) => boolean) => mockAppointments.some((appointment) =>
    appointment.id !== input.excludeAppointmentId && appointment.status !== "cancelada" && match(appointment)
    && rangesOverlap(input.start, input.end, appointment.start, appointment.end))
  if (busy((appointment) => appointment.professionalId === input.professionalId)) return "El profesional ya tiene una cita agendada en ese horario"
  if (input.roomId && busy((appointment) => appointment.roomId === input.roomId)) return "El consultorio ya está ocupado en ese horario"
  if (mockScheduleBlocks.some((block) => block.professionalId === input.professionalId && rangesOverlap(input.start, input.end, block.start, block.end))) {
    return "El profesional tiene un bloqueo de horario en ese rango"
  }
  if (input.roomId && mockScheduleBlocks.some((block) => block.roomId === input.roomId && rangesOverlap(input.start, input.end, block.start, block.end))) {
    return "El consultorio tiene un bloqueo de horario en ese rango"
  }
  return null
}

/** Un bloqueo no puede crearse sobre una cita ya agendada; los bloqueos entre sí sí pueden superponerse. */
function findScheduleBlockConflict(input: { professionalId?: string; roomId?: string; start: string; end: string }): string | null {
  const busy = (match: (appointment: Appointment) => boolean) => mockAppointments.some((appointment) =>
    appointment.status !== "cancelada" && match(appointment) && rangesOverlap(input.start, input.end, appointment.start, appointment.end))
  if (input.professionalId && busy((appointment) => appointment.professionalId === input.professionalId)) return "El profesional tiene una cita agendada en ese horario"
  if (input.roomId && busy((appointment) => appointment.roomId === input.roomId)) return "El consultorio tiene una cita agendada en ese horario"
  return null
}

function find(id: string): number {
  const index = mockAppointments.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Cita no encontrada", 404)
  return index
}

/** Como el servidor, que la registra en la misma transacción de la cita. */
async function notify(appointment: Appointment, type: "confirmacion_cita" | "cancelacion_cita") {
  await logMockAppointmentEvent({ patientId: appointment.patientId, appointmentId: appointment.id, type })
}

export const mockAppointmentsApi: AppointmentsApi = {
  async list(range) {
    await mockDelay(300)
    return mockAppointments.filter((appointment) => inRange(appointment.start, range))
  },
  async listByPatient(patientId) {
    await mockDelay(250)
    return mockAppointments
      .filter((appointment) => appointment.patientId === patientId)
      .sort((a, b) => b.start.localeCompare(a.start))
  },
  async get(id) {
    await mockDelay(200)
    return mockAppointments[find(id)]
  },
  async create(values) {
    await mockDelay()
    const { start, end } = toIsoRange(values)
    const conflict = findAppointmentConflict({ professionalId: values.professionalId, roomId: values.roomId || undefined, start, end })
    if (conflict) throw new ApiError(conflict, 409, [{ field: "startTime", message: conflict }])
    const appointment: Appointment = {
      id: nextId("apt"),
      patientId: values.patientId,
      professionalId: values.professionalId,
      treatmentId: values.treatmentId || undefined,
      roomId: values.roomId || undefined,
      start,
      end,
      status: "programada",
      notes: values.notes,
      createdAt: new Date().toISOString(),
    }
    mockAppointments.push(appointment)
    await notify(appointment, "confirmacion_cita")
    return appointment
  },
  async update(id, values) {
    await mockDelay()
    const index = find(id)
    const { start, end } = toIsoRange(values)
    const conflict = findAppointmentConflict({ professionalId: values.professionalId, roomId: values.roomId || undefined, start, end, excludeAppointmentId: id })
    if (conflict) throw new ApiError(conflict, 409, [{ field: "startTime", message: conflict }])
    mockAppointments[index] = {
      ...mockAppointments[index],
      patientId: values.patientId,
      professionalId: values.professionalId,
      treatmentId: values.treatmentId || undefined,
      roomId: values.roomId || undefined,
      start,
      end,
      notes: values.notes,
    }
    return mockAppointments[index]
  },
  async updateStatus(id, status) {
    await mockDelay(250)
    const index = find(id)
    mockAppointments[index] = { ...mockAppointments[index], status }
    if (status === "cancelada") await notify(mockAppointments[index], "cancelacion_cita")
    return mockAppointments[index]
  },
  async listScheduleBlocks(range) {
    await mockDelay(250)
    return mockScheduleBlocks.filter((block) => inRange(block.start, range))
  },
  async createScheduleBlock(values) {
    await mockDelay()
    const { start, end } = toIsoRange(values)
    const conflict = findScheduleBlockConflict({ professionalId: values.professionalId || undefined, roomId: values.roomId || undefined, start, end })
    if (conflict) throw new ApiError(conflict, 409, [{ field: "startTime", message: conflict }])
    const block = {
      id: nextId("blk"),
      professionalId: values.professionalId || undefined,
      roomId: values.roomId || undefined,
      start,
      end,
      reason: values.reason,
      createdAt: new Date().toISOString(),
    }
    mockScheduleBlocks.push(block)
    return block
  },
  async removeScheduleBlock(id) {
    await mockDelay(250)
    const index = mockScheduleBlocks.findIndex((item) => item.id === id)
    if (index === -1) throw new ApiError("Bloqueo no encontrado", 404)
    mockScheduleBlocks.splice(index, 1)
  },
}

export const mockAgendaCatalogsApi: AgendaCatalogsApi = {
  async listProfessionals() {
    await mockDelay(150)
    return mockProfessionals
  },
  async listRooms() {
    await mockDelay(150)
    return mockRooms
  },
}
