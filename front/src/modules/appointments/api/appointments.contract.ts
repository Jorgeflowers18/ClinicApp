import type {
  Appointment,
  AppointmentFormValues,
  AppointmentStatus,
  Professional,
  ProfessionalFormValues,
  ProfessionalUpdateResult,
  Room,
  RoomFormValues,
  ScheduleBlock,
  ScheduleBlockFormValues,
} from "../types/appointment.types"

/** Días de la clínica, `YYYY-MM-DD`, inclusivos. */
export interface DateRange {
  from: string
  to: string
}

/**
 * Agenda: citas y bloqueos. `appointments.http.ts` lo cumple con la API.
 *
 * Los choques (profesional, consultorio y bloqueos) los valida quien guarda: el servidor responde `409` con
 * `errors.startTime`. Las notificaciones de la cita (confirmación y cancelación) también las registra el
 * servidor, en la misma transacción: no están en el contrato.
 */
export interface AppointmentsApi {
  /** Con `range`, solo las citas que empiezan en esos días. Sin él, todas (evitarlo: con muchos datos es una lectura grande). */
  list(range?: DateRange, signal?: AbortSignal): Promise<Appointment[]>
  /** De la más reciente a la más antigua. */
  listByPatient(patientId: string, signal?: AbortSignal): Promise<Appointment[]>
  get(id: string, signal?: AbortSignal): Promise<Appointment>
  create(values: AppointmentFormValues): Promise<Appointment>
  /** Solo citas programadas o confirmadas (`409` si no). */
  update(id: string, values: AppointmentFormValues): Promise<Appointment>
  /** Las transiciones las valida el servidor (`409` si no se permite). */
  updateStatus(id: string, status: AppointmentStatus): Promise<Appointment>
  listScheduleBlocks(range?: DateRange, signal?: AbortSignal): Promise<ScheduleBlock[]>
  createScheduleBlock(values: ScheduleBlockFormValues): Promise<ScheduleBlock>
  removeScheduleBlock(id: string): Promise<void>
}

/**
 * Catálogos de la agenda. Traen también los inactivos: los selectores muestran solo los activos.
 * Crear y editar es solo del admin (`403` si no). No se borran: se desactivan.
 */
export interface AgendaCatalogsApi {
  listProfessionals(signal?: AbortSignal): Promise<Professional[]>
  listRooms(signal?: AbortSignal): Promise<Room[]>
  createProfessional(values: ProfessionalFormValues): Promise<Professional>
  /** `userId` es el usuario vinculado que se conserva (o `null` para desvincularlo). */
  updateProfessional(id: string, values: ProfessionalFormValues, userId: string | null): Promise<ProfessionalUpdateResult>
  /** Un consultorio activo con el mismo nombre responde `409` con `errors.name`. */
  createRoom(values: RoomFormValues): Promise<Room>
  updateRoom(id: string, values: RoomFormValues): Promise<Room>
}
