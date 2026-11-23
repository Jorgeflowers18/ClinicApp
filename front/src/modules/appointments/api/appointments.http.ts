import type { components } from "@/shared/api/schema"
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/shared/lib/http"

import type { AgendaCatalogsApi, AppointmentsApi } from "./appointments.contract"
import type {
  Appointment,
  AppointmentFormValues,
  ProfessionalFormValues,
  RoomFormValues,
  ScheduleBlock,
  ScheduleBlockFormValues,
} from "../types/appointment.types"

type AppointmentDto = components["schemas"]["AppointmentDto"]
type AppointmentRequest = components["schemas"]["AppointmentRequest"]
type ScheduleBlockDto = components["schemas"]["ScheduleBlockDto"]
type ScheduleBlockRequest = components["schemas"]["ScheduleBlockRequest"]
type ProfessionalDto = components["schemas"]["ProfessionalDto"]
type RoomDto = components["schemas"]["RoomDto"]
type ProfessionalRequest = components["schemas"]["ProfessionalRequest"]
type ProfessionalUpdateDto = components["schemas"]["ProfessionalUpdateDto"]
type RoomRequest = components["schemas"]["RoomRequest"]

export const toAppointment = (dto: AppointmentDto): Appointment => ({
  id: dto.id,
  patientId: dto.patientId,
  patientName: dto.patientName,
  professionalId: dto.professionalId,
  treatmentId: dto.treatmentId ?? undefined,
  roomId: dto.roomId ?? undefined,
  start: dto.start,
  end: dto.end,
  status: dto.status as Appointment["status"],
  notes: dto.notes ?? undefined,
  createdAt: dto.createdAt,
})

const toBlock = (dto: ScheduleBlockDto): ScheduleBlock => ({
  ...dto,
  professionalId: dto.professionalId ?? undefined,
  roomId: dto.roomId ?? undefined,
})

// La fecha y las horas van en hora de la clínica: el servidor las convierte a UTC con su zona (America/Guayaquil).
const toRequest = (values: AppointmentFormValues): AppointmentRequest => ({
  patientId: values.patientId,
  professionalId: values.professionalId,
  treatmentId: values.treatmentId || null,
  roomId: values.roomId || null,
  notes: values.notes || null,
  date: values.date,
  startTime: values.startTime,
  endTime: values.endTime,
})

const toBlockRequest = (values: ScheduleBlockFormValues): ScheduleBlockRequest => ({
  professionalId: values.professionalId || null,
  roomId: values.roomId || null,
  reason: values.reason,
  date: values.date,
  startTime: values.startTime,
  endTime: values.endTime,
})

export const httpAppointmentsApi: AppointmentsApi = {
  async list(range, signal) {
    return (await apiGet<AppointmentDto[]>("/appointments", { params: range, signal })).map(toAppointment)
  },
  async listByPatient(patientId, signal) {
    return (await apiGet<AppointmentDto[]>("/appointments", { params: { patientId }, signal })).map(toAppointment)
  },
  async get(id, signal) {
    return toAppointment(await apiGet<AppointmentDto>(`/appointments/${id}`, { signal }))
  },
  async create(values) {
    return toAppointment(await apiPost<AppointmentDto>("/appointments", toRequest(values)))
  },
  async update(id, values) {
    return toAppointment(await apiPut<AppointmentDto>(`/appointments/${id}`, toRequest(values)))
  },
  async updateStatus(id, status) {
    return toAppointment(await apiPatch<AppointmentDto>(`/appointments/${id}/status`, { status }))
  },
  async listScheduleBlocks(range, signal) {
    return (await apiGet<ScheduleBlockDto[]>("/schedule-blocks", { params: range, signal })).map(toBlock)
  },
  async createScheduleBlock(values) {
    return toBlock(await apiPost<ScheduleBlockDto>("/schedule-blocks", toBlockRequest(values)))
  },
  async removeScheduleBlock(id) {
    await apiDelete(`/schedule-blocks/${id}`)
  },
}

export const httpAgendaCatalogsApi: AgendaCatalogsApi = {
  async listProfessionals(signal) {
    return (await apiGet<ProfessionalDto[]>("/professionals", { signal })).map((dto) => ({ ...dto }))
  },
  async listRooms(signal) {
    return (await apiGet<RoomDto[]>("/rooms", { signal })).map((dto) => ({ ...dto }))
  },
  async createProfessional(values) {
    return { ...(await apiPost<ProfessionalDto>("/professionals", toProfessionalRequest(values, null))) }
  },
  async updateProfessional(id, values, userId) {
    return { ...(await apiPut<ProfessionalUpdateDto>(`/professionals/${id}`, toProfessionalRequest(values, userId))) }
  },
  async createRoom(values) {
    return { ...(await apiPost<RoomDto>("/rooms", toRoomRequest(values))) }
  },
  async updateRoom(id, values) {
    return { ...(await apiPut<RoomDto>(`/rooms/${id}`, toRoomRequest(values))) }
  },
}

// El PUT reemplaza el usuario vinculado: sin `userId` lo desvincularía, por eso se manda el que ya tenía.
const toProfessionalRequest = (values: ProfessionalFormValues, userId: string | null): ProfessionalRequest => ({
  name: values.name.trim(),
  specialty: values.specialty.trim(),
  registrationNumber: values.registrationNumber.trim() || null,
  active: values.active,
  userId,
})

const toRoomRequest = (values: RoomFormValues): RoomRequest => ({ name: values.name.trim(), active: values.active })
