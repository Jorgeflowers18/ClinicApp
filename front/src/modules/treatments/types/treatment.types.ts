import { z } from "zod"

export const consumptionSchema = z.object({
  itemId: z.string().min(1, "Selecciona un insumo"),
  quantity: z.coerce.number().int().min(1, "Mínimo 1"),
})

export const treatmentSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  category: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
  durationMinutes: z.coerce.number().int().min(5, "Mínimo 5 minutos"),
  price: z.coerce.number().min(0, "El precio no puede ser negativo"),
  active: z.boolean(),
  consumption: z.array(consumptionSchema),
})

export type TreatmentFormValues = z.infer<typeof treatmentSchema>
export type TreatmentConsumption = z.infer<typeof consumptionSchema>

export interface Treatment extends TreatmentFormValues {
  id: string
  createdAt: string
}

export const assignmentStatuses = ["en_progreso", "completado", "suspendido"] as const
export type AssignmentStatus = (typeof assignmentStatuses)[number]

export const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  en_progreso: "En progreso",
  completado: "Completado",
  suspendido: "Suspendido",
}

/** Costo de una asignación: el cobrado en la atención o, en las antiguas, el precio del catálogo. */
export function assignmentPrice(assignment: Pick<TreatmentAssignment, "price">, catalogPrice: number) {
  return assignment.price ?? catalogPrice
}

export interface TreatmentAssignment {
  id: string
  treatmentId: string
  patientId: string
  totalSessions: number
  completedSessions: number
  status: AssignmentStatus
  startDate: string
  /** Pieza o zona tratada (vacío en asignaciones antiguas). */
  tooth?: string
  /** Atención clínica en la que se realizó (vacío en asignaciones antiguas). */
  sourceEncounterId?: string
  /** Costo cobrado en la atención (puede diferir del catálogo, por ejemplo un descuento). Vacío en asignaciones antiguas: se usa el precio del catálogo. */
  price?: number
  /** Clave de idempotencia: atención + tratamiento realizado de esa atención. */
  sourceKey?: string
}

/**
 * Tratamiento realizado en una atención: se registra ya completado (una sesión), descontando sus
 * insumos. Los tratamientos solo se registran desde la historia clínica.
 */
export interface CreateAssignmentInput {
  treatmentId: string
  patientId: string
  /** Fecha de la atención. */
  date: string
  tooth: string
  sourceEncounterId: string
  sourceKey: string
  /** Costo cobrado en la atención. */
  price: number
}
