import type { Paginated } from "@/shared/types/common"

import type { Patient, PatientFormValues, PatientsQuery } from "../types/patient.types"

/**
 * Pacientes. `patients.http.ts` lo cumple con la API.
 */
export interface PatientsApi {
  /** Sin `deleted`, solo los activos (sin baja). Con `deleted: true` (solo admin), los dados de baja. */
  list(query: PatientsQuery, signal?: AbortSignal): Promise<Paginated<Patient>>
  /** También devuelve a un paciente dado de baja (con `deletedAt`). */
  get(id: string, signal?: AbortSignal): Promise<Patient>
  /** El N.° de historia lo asigna el servidor. */
  create(values: PatientFormValues): Promise<Patient>
  update(id: string, values: PatientFormValues): Promise<Patient>
  /** Baja lógica: el paciente sale de la lista y conserva sus citas, historia, tratamientos y pagos. */
  remove(id: string): Promise<void>
  /** Reactiva a un paciente dado de baja (solo admin). */
  restore(id: string): Promise<Patient>
}
