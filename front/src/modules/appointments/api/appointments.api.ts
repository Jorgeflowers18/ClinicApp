import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { mockDelay, nextId } from "@/shared/lib/mock"
import { ApiError } from "@/shared/types/common"

import { mockAppointments, mockProfessionals } from "./appointments.mock-data"
import type { Appointment, AppointmentFormValues } from "../types/appointment.types"

function toIsoRange(values: AppointmentFormValues) {
  return {
    start: new Date(`${values.date}T${values.startTime}`).toISOString(),
    end: new Date(`${values.date}T${values.endTime}`).toISOString(),
  }
}

function hasOverlap(
  professionalId: string,
  start: string,
  end: string,
  excludeId?: string
) {
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()

  return mockAppointments.some((appointment) => {
    if (appointment.id === excludeId) return false
    if (appointment.professionalId !== professionalId) return false
    if (appointment.status === "cancelada") return false

    const existingStart = new Date(appointment.start).getTime()
    const existingEnd = new Date(appointment.end).getTime()
    return startTime < existingEnd && endTime > existingStart
  })
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

  if (hasOverlap(values.professionalId, start, end)) {
    throw new ApiError(
      "El profesional ya tiene una cita agendada en ese horario",
      409,
      [{ field: "startTime", message: "Horario no disponible para el profesional" }]
    )
  }

  const appointment: Appointment = {
    id: nextId("apt"),
    patientId: values.patientId,
    professionalId: values.professionalId,
    treatmentId: values.treatmentId || undefined,
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

  if (hasOverlap(values.professionalId, start, end, id)) {
    throw new ApiError(
      "El profesional ya tiene una cita agendada en ese horario",
      409,
      [{ field: "startTime", message: "Horario no disponible para el profesional" }]
    )
  }

  mockAppointments[index] = {
    ...mockAppointments[index],
    patientId: values.patientId,
    professionalId: values.professionalId,
    treatmentId: values.treatmentId || undefined,
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

export const appointmentsApi = {
  list: env.useMockApi ? listMock : listReal,
  get: env.useMockApi ? getMock : getReal,
  create: env.useMockApi ? createMock : createReal,
  update: env.useMockApi ? updateMock : updateReal,
  updateStatus: env.useMockApi ? updateStatusMock : updateStatusReal,
  listProfessionals: env.useMockApi ? listProfessionalsMock : listProfessionalsReal,
}
