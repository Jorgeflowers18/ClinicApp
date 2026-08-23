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

export interface TreatmentAssignment {
  id: string
  treatmentId: string
  patientId: string
  totalSessions: number
  completedSessions: number
  status: AssignmentStatus
  startDate: string
}
