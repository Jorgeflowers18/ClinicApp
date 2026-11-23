import type { PageQuery, Paginated } from "@/shared/types/common"

import type { CreateAssignmentInput, Treatment, TreatmentAssignment, TreatmentFormValues } from "../types/treatment.types"

/**
 * Catálogo de tratamientos y tratamientos realizados. `treatments.http.ts` lo cumple con la API.
 *
 * El descuento de insumos al registrar un tratamiento realizado lo hace el servidor (FEFO):
 * no está en el contrato.
 */
export interface TreatmentsApi {
  list(query: PageQuery, signal?: AbortSignal): Promise<Paginated<Treatment>>
  /** Todos los activos, sin paginar (para los selectores). */
  listActive(signal?: AbortSignal): Promise<Treatment[]>
  get(id: string, signal?: AbortSignal): Promise<Treatment>
  create(values: TreatmentFormValues): Promise<Treatment>
  update(id: string, values: TreatmentFormValues): Promise<Treatment>
  /** `409` si ya se usó (citas, realizados o historias): se ofrece desactivarlo. */
  remove(id: string): Promise<void>
  listAssignments(treatmentId: string, signal?: AbortSignal): Promise<TreatmentAssignment[]>
  listAssignmentsByPatient(patientId: string, signal?: AbortSignal): Promise<TreatmentAssignment[]>
  /** Idempotente por `sourceKey`: reintentar no lo duplica. */
  createAssignment(input: CreateAssignmentInput): Promise<TreatmentAssignment>
}
