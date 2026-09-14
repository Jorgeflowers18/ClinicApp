import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { mockDelay, nextId } from "@/shared/lib/mock"
import { ApiError } from "@/shared/types/common"

import { mockAppointments, mockProfessionals, mockRooms, mockScheduleBlocks } from "./appointments.mock-data"
import type {
  Appointment,
  AppointmentFormValues,
  ScheduleBlock,
  ScheduleBlockFormValues,
} from "../types/appointment.types"

function toIsoRange(values: { date: string; startTime: string; endTime: string }) {
  return {
    start: new Date(`${values.date}T${values.startTime}`).toISOString(),
    end: new Date(`${values.date}T${values.endTime}`).toISOString(),
  }
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(aEnd).getTime() > new Date(bStart).getTime()
}

interface AppointmentConflictInput {
  professionalId: string
  roomId?: string
  start: string
  end: string
  excludeAppointmentId?: string
}

/** Valida disponibilidad de profesional y consultorio para una cita: otras citas + bloqueos de horario. */
function findAppointmentConflict(input: AppointmentConflictInput): string | null {
  const professionalBusy = mockAppointments.some((appointment) => {
    if (appointment.id === input.excludeAppointmentId) return false
    if (appointment.professionalId !== input.professionalId) return false
    if (appointment.status === "cancelada") return false
    return rangesOverlap(input.start, input.end, appointment.start, appointment.end)
  })
  if (professionalBusy) return "El profesional ya tiene una cita agendada en ese horario"

  if (input.roomId) {
    const roomBusy = mockAppointments.some((appointment) => {
      if (appointment.id === input.excludeAppointmentId) return false
      if (appointment.roomId !== input.roomId) return false
      if (appointment.status === "cancelada") return false
      return rangesOverlap(input.start, input.end, appointment.start, appointment.end)
    })
    if (roomBusy) return "El consultorio ya está ocupado en ese horario"
  }

  const professionalBlocked = mockScheduleBlocks.some(
    (block) => block.professionalId === input.professionalId && rangesOverlap(input.start, input.end, block.start, block.end)
  )
  if (professionalBlocked) return "El profesional tiene un bloqueo de horario en ese rango"

  if (input.roomId) {
    const roomBlocked = mockScheduleBlocks.some(
      (block) => block.roomId === input.roomId && rangesOverlap(input.start, input.end, block.start, block.end)
    )
    if (roomBlocked) return "El consultorio tiene un bloqueo de horario en ese rango"
  }

  return null
}

interface ScheduleBlockConflictInput {
  professionalId?: string
  roomId?: string
  start: string
  end: string
}

/** Un bloqueo no puede crearse sobre una cita ya agendada; los bloqueos entre sí sí pueden superponerse. */
function findScheduleBlockConflict(input: ScheduleBlockConflictInput): string | null {
  if (input.professionalId) {
    const professionalBusy = mockAppointments.some((appointment) => {
      if (appointment.professionalId !== input.professionalId) return false
      if (appointment.status === "cancelada") return false
      return rangesOverlap(input.start, input.end, appointment.start, appointment.end)
    })
    if (professionalBusy) return "El profesional tiene una cita agendada en ese horario"
  }

  if (input.roomId) {
    const roomBusy = mockAppointments.some((appointment) => {
      if (appointment.roomId !== input.roomId) return false
      if (appointment.status === "cancelada") return false
      return rangesOverlap(input.start, input.end, appointment.start, appointment.end)
    })
    if (roomBusy) return "El consultorio tiene una cita agendada en ese horario"
  }

  return null
}

async function listMock(): Promise<Appointment[]> {
  await mockDelay(300)
  return [...mockAppointments]
}

async function getMock(id: string): Promise<Appointment> {
  await mockDelay(200)
  const appointment = mockAppointments.find((item) => item.id === id)
  if (!appointment) throw new ApiError("Cita no encontrada", 404)
  return appointment
}

async function createMock(values: AppointmentFormValues): Promise<Appointment> {
  await mockDelay()
  const { start, end } = toIsoRange(values)

  const conflict = findAppointmentConflict({
    professionalId: values.professionalId,
    roomId: values.roomId || undefined,
    start,
    end,
  })
  if (conflict) {
    throw new ApiError(conflict, 409, [{ field: "startTime", message: conflict }])
  }

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
  return appointment
}

async function updateMock(id: string, values: AppointmentFormValues): Promise<Appointment> {
  await mockDelay()
  const index = mockAppointments.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Cita no encontrada", 404)

  const { start, end } = toIsoRange(values)

  const conflict = findAppointmentConflict({
    professionalId: values.professionalId,
    roomId: values.roomId || undefined,
    start,
    end,
    excludeAppointmentId: id,
  })
  if (conflict) {
    throw new ApiError(conflict, 409, [{ field: "startTime", message: conflict }])
  }

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
}

async function updateStatusMock(id: string, status: Appointment["status"]): Promise<Appointment> {
  await mockDelay(250)
  const index = mockAppointments.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Cita no encontrada", 404)
  mockAppointments[index] = { ...mockAppointments[index], status }
  return mockAppointments[index]
}

async function listProfessionalsMock(): Promise<typeof mockProfessionals> {
  await mockDelay(150)
  return mockProfessionals
}

async function listRoomsMock(): Promise<typeof mockRooms> {
  await mockDelay(150)
  return mockRooms
}

async function listScheduleBlocksMock(): Promise<ScheduleBlock[]> {
  await mockDelay(250)
  return [...mockScheduleBlocks]
}

async function createScheduleBlockMock(values: ScheduleBlockFormValues): Promise<ScheduleBlock> {
  await mockDelay()
  const { start, end } = toIsoRange(values)

  const conflict = findScheduleBlockConflict({
    professionalId: values.professionalId || undefined,
    roomId: values.roomId || undefined,
    start,
    end,
  })
  if (conflict) {
    throw new ApiError(conflict, 409, [{ field: "startTime", message: conflict }])
  }

  const block: ScheduleBlock = {
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
}

async function removeScheduleBlockMock(id: string): Promise<void> {
  await mockDelay(250)
  const index = mockScheduleBlocks.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Bloqueo no encontrado", 404)
  mockScheduleBlocks.splice(index, 1)
}

// TODO: conectar a endpoint real -> GET /appointments (API .NET), idealmente con filtros de rango de fechas
async function listReal(): Promise<Appointment[]> {
  const { data } = await http.get<Appointment[]>("/appointments")
  return data
}

// TODO: conectar a endpoint real -> GET /appointments/:id
async function getReal(id: string): Promise<Appointment> {
  const { data } = await http.get<Appointment>(`/appointments/${id}`)
  return data
}

// TODO: conectar a endpoint real -> POST /appointments (el backend debe validar disponibilidad)
async function createReal(values: AppointmentFormValues): Promise<Appointment> {
  const { data } = await http.post<Appointment>("/appointments", values)
  return data
}

// TODO: conectar a endpoint real -> PUT /appointments/:id
async function updateReal(id: string, values: AppointmentFormValues): Promise<Appointment> {
  const { data } = await http.put<Appointment>(`/appointments/${id}`, values)
  return data
}

// TODO: conectar a endpoint real -> PATCH /appointments/:id/status
async function updateStatusReal(id: string, status: Appointment["status"]): Promise<Appointment> {
  const { data } = await http.patch<Appointment>(`/appointments/${id}/status`, { status })
  return data
}

// TODO: conectar a endpoint real -> GET /professionals
async function listProfessionalsReal() {
  const { data } = await http.get<typeof mockProfessionals>("/professionals")
  return data
}

// TODO: conectar a endpoint real -> GET /rooms
async function listRoomsReal() {
  const { data } = await http.get<typeof mockRooms>("/rooms")
  return data
}

// TODO: conectar a endpoint real -> GET /schedule-blocks
async function listScheduleBlocksReal(): Promise<ScheduleBlock[]> {
  const { data } = await http.get<ScheduleBlock[]>("/schedule-blocks")
  return data
}

// TODO: conectar a endpoint real -> POST /schedule-blocks (el backend debe validar disponibilidad)
async function createScheduleBlockReal(values: ScheduleBlockFormValues): Promise<ScheduleBlock> {
  const { data } = await http.post<ScheduleBlock>("/schedule-blocks", values)
  return data
}

// TODO: conectar a endpoint real -> DELETE /schedule-blocks/:id
async function removeScheduleBlockReal(id: string): Promise<void> {
  await http.delete(`/schedule-blocks/${id}`)
}

export const appointmentsApi = {
  list: env.useMockApi ? listMock : listReal,
  get: env.useMockApi ? getMock : getReal,
  create: env.useMockApi ? createMock : createReal,
  update: env.useMockApi ? updateMock : updateReal,
  updateStatus: env.useMockApi ? updateStatusMock : updateStatusReal,
  listProfessionals: env.useMockApi ? listProfessionalsMock : listProfessionalsReal,
  listRooms: env.useMockApi ? listRoomsMock : listRoomsReal,
  listScheduleBlocks: env.useMockApi ? listScheduleBlocksMock : listScheduleBlocksReal,
  createScheduleBlock: env.useMockApi ? createScheduleBlockMock : createScheduleBlockReal,
  removeScheduleBlock: env.useMockApi ? removeScheduleBlockMock : removeScheduleBlockReal,
}
