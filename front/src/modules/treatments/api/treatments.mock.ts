import { mockDelay, nextId, paginate } from "@/shared/lib/mock"
import { ApiError } from "@/shared/types/common"
import { inventoryApi } from "@/modules/inventory/api/inventory.api"

import type { TreatmentsApi } from "./treatments.contract"
import { mockTreatmentAssignments, mockTreatments } from "./treatments.mock-data"
import type { Treatment, TreatmentAssignment } from "../types/treatment.types"

function find(id: string): number {
  const index = mockTreatments.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Tratamiento no encontrado", 404)
  return index
}

export const mockTreatmentsApi: TreatmentsApi = {
  async list(query) {
    await mockDelay()
    const search = query.search?.trim().toLowerCase()
    const filtered = search
      ? mockTreatments.filter((treatment) => [treatment.name, treatment.category].join(" ").toLowerCase().includes(search))
      : mockTreatments
    return paginate([...filtered].sort((a, b) => a.name.localeCompare(b.name)), query)
  },
  async listActive() {
    await mockDelay(150)
    return mockTreatments.filter((treatment) => treatment.active)
  },
  async get(id) {
    await mockDelay(250)
    return mockTreatments[find(id)]
  },
  async create(values) {
    await mockDelay()
    const treatment: Treatment = { ...values, id: nextId("trt"), createdAt: new Date().toISOString() }
    mockTreatments.unshift(treatment)
    return treatment
  },
  async update(id, values) {
    await mockDelay()
    const index = find(id)
    mockTreatments[index] = { ...mockTreatments[index], ...values }
    return mockTreatments[index]
  },
  async remove(id) {
    await mockDelay(300)
    mockTreatments.splice(find(id), 1)
  },
  async listAssignments(treatmentId) {
    await mockDelay(250)
    return mockTreatmentAssignments.filter((assignment) => assignment.treatmentId === treatmentId)
  },
  async listAssignmentsByPatient(patientId) {
    await mockDelay(200)
    return mockTreatmentAssignments
      .filter((assignment) => assignment.patientId === patientId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
  },
  /**
   * Registra un tratamiento realizado en una atención: queda completado (una sesión) y descuenta sus insumos,
   * como hace el servidor. Idempotente por `sourceKey`: reintentar el registro de la atención no lo duplica.
   */
  async createAssignment(input) {
    await mockDelay(250)
    const existing = mockTreatmentAssignments.find((assignment) => assignment.sourceKey === input.sourceKey)
    if (existing) return existing

    const treatment = mockTreatments.find((item) => item.id === input.treatmentId)
    if (!treatment) throw new ApiError("Tratamiento no encontrado", 404)
    if (!treatment.active) throw new ApiError(`El tratamiento "${treatment.name}" está inactivo`, 400)

    const assignment: TreatmentAssignment = {
      id: nextId("asg"),
      treatmentId: input.treatmentId,
      patientId: input.patientId,
      totalSessions: 1,
      completedSessions: 1,
      status: "completado",
      startDate: input.date,
      tooth: input.tooth,
      sourceEncounterId: input.sourceEncounterId,
      sourceKey: input.sourceKey,
      price: input.price,
    }
    mockTreatmentAssignments.push(assignment)

    for (const entry of treatment.consumption) {
      await inventoryApi.registerConsumption({
        itemId: entry.itemId,
        quantity: entry.quantity,
        reason: `Consumo clínico — ${treatment.name}`,
        treatmentAssignmentId: assignment.id,
        patientId: assignment.patientId,
      })
    }
    return assignment
  },
}
