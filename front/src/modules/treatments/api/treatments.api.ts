import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { mockDelay, nextId, paginate } from "@/shared/lib/mock"
import { ApiError, type PageQuery, type Paginated } from "@/shared/types/common"
import { inventoryApi } from "@/modules/inventory/api/inventory.api"

import { mockTreatmentAssignments, mockTreatments } from "./treatments.mock-data"
import type {
  CreateAssignmentInput,
  Treatment,
  TreatmentAssignment,
  TreatmentFormValues,
} from "../types/treatment.types"

async function listMock(query: PageQuery): Promise<Paginated<Treatment>> {
  await mockDelay()
  const search = query.search?.trim().toLowerCase()

  const filtered = search
    ? mockTreatments.filter((treatment) =>
        [treatment.name, treatment.category].join(" ").toLowerCase().includes(search)
      )
    : mockTreatments

  return paginate([...filtered].sort((a, b) => a.name.localeCompare(b.name)), query)
}

async function listActiveMock(): Promise<Treatment[]> {
  await mockDelay(150)
  return mockTreatments.filter((treatment) => treatment.active)
}

async function getMock(id: string): Promise<Treatment> {
  await mockDelay(250)
  const treatment = mockTreatments.find((item) => item.id === id)
  if (!treatment) throw new ApiError("Tratamiento no encontrado", 404)
  return treatment
}

async function createMock(values: TreatmentFormValues): Promise<Treatment> {
  await mockDelay()
  const treatment: Treatment = { ...values, id: nextId("trt"), createdAt: new Date().toISOString() }
  mockTreatments.unshift(treatment)
  return treatment
}

async function updateMock(id: string, values: TreatmentFormValues): Promise<Treatment> {
  await mockDelay()
  const index = mockTreatments.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Tratamiento no encontrado", 404)
  mockTreatments[index] = { ...mockTreatments[index], ...values }
  return mockTreatments[index]
}

async function removeMock(id: string): Promise<void> {
  await mockDelay(300)
  const index = mockTreatments.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Tratamiento no encontrado", 404)
  mockTreatments.splice(index, 1)
}

async function listAssignmentsMock(treatmentId: string): Promise<TreatmentAssignment[]> {
  await mockDelay(250)
  return mockTreatmentAssignments.filter((assignment) => assignment.treatmentId === treatmentId)
}

// MOCK-ONLY
async function listAssignmentsByPatientMock(patientId: string): Promise<TreatmentAssignment[]> {
  await mockDelay(200)
  return mockTreatmentAssignments
    .filter((assignment) => assignment.patientId === patientId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
}

// MOCK-ONLY
/**
 * Registra un tratamiento realizado en una atención: queda completado (una sesión) y descuenta sus
 * insumos en Inventario. Idempotente por `sourceKey`: reintentar el registro de la atención no lo duplica.
 */
async function createAssignmentMock(input: CreateAssignmentInput): Promise<TreatmentAssignment> {
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
}

// TODO: conectar a endpoint real -> GET /treatments
async function listReal(query: PageQuery): Promise<Paginated<Treatment>> {
  const { data } = await http.get<Paginated<Treatment>>("/treatments", { params: query })
  return data
}

// TODO: conectar a endpoint real -> GET /treatments?active=true
async function listActiveReal(): Promise<Treatment[]> {
  const { data } = await http.get<Treatment[]>("/treatments", { params: { active: true } })
  return data
}

// TODO: conectar a endpoint real -> GET /treatments/:id
async function getReal(id: string): Promise<Treatment> {
  const { data } = await http.get<Treatment>(`/treatments/${id}`)
  return data
}

// TODO: conectar a endpoint real -> POST /treatments
async function createReal(values: TreatmentFormValues): Promise<Treatment> {
  const { data } = await http.post<Treatment>("/treatments", values)
  return data
}

// TODO: conectar a endpoint real -> PUT /treatments/:id
async function updateReal(id: string, values: TreatmentFormValues): Promise<Treatment> {
  const { data } = await http.put<Treatment>(`/treatments/${id}`, values)
  return data
}

// TODO: conectar a endpoint real -> DELETE /treatments/:id
async function removeReal(id: string): Promise<void> {
  await http.delete(`/treatments/${id}`)
}

// TODO: conectar a endpoint real -> GET /treatments/:id/assignments
async function listAssignmentsReal(treatmentId: string): Promise<TreatmentAssignment[]> {
  const { data } = await http.get<TreatmentAssignment[]>(`/treatments/${treatmentId}/assignments`)
  return data
}

// TODO: conectar a endpoint real -> GET /treatment-assignments?patientId=
async function listAssignmentsByPatientReal(patientId: string): Promise<TreatmentAssignment[]> {
  const { data } = await http.get<TreatmentAssignment[]>("/treatment-assignments", { params: { patientId } })
  return data
}

// TODO: conectar a endpoint real -> POST /treatment-assignments (idempotente por sourceKey; descuenta insumos)
async function createAssignmentReal(input: CreateAssignmentInput): Promise<TreatmentAssignment> {
  const { data } = await http.post<TreatmentAssignment>("/treatment-assignments", input)
  return data
}

export const treatmentsApi = {
  list: env.useMockApi ? listMock : listReal,
  listActive: env.useMockApi ? listActiveMock : listActiveReal,
  get: env.useMockApi ? getMock : getReal,
  create: env.useMockApi ? createMock : createReal,
  update: env.useMockApi ? updateMock : updateReal,
  remove: env.useMockApi ? removeMock : removeReal,
  listAssignments: env.useMockApi ? listAssignmentsMock : listAssignmentsReal,
  listAssignmentsByPatient: env.useMockApi ? listAssignmentsByPatientMock : listAssignmentsByPatientReal,
  createAssignment: env.useMockApi ? createAssignmentMock : createAssignmentReal,
}
