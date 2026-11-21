import type { components } from "@/shared/api/schema"
import { apiDelete, apiGet, apiPost, apiPut } from "@/shared/lib/http"
import type { Paginated } from "@/shared/types/common"

import type { TreatmentsApi } from "./treatments.contract"
import type { Treatment, TreatmentAssignment, TreatmentFormValues } from "../types/treatment.types"

type TreatmentDto = components["schemas"]["TreatmentDto"]
type TreatmentRequest = components["schemas"]["TreatmentRequest"]
type TreatmentAssignmentDto = components["schemas"]["TreatmentAssignmentDto"]
type CreateAssignmentRequest = components["schemas"]["CreateAssignmentRequest"]

export const toTreatment = (dto: TreatmentDto): Treatment => ({
  ...dto,
  description: dto.description ?? undefined,
  consumption: dto.consumption.map(({ itemId, quantity }) => ({ itemId, quantity })),
})

export const toAssignment = (dto: TreatmentAssignmentDto): TreatmentAssignment => ({
  ...dto,
  status: dto.status as TreatmentAssignment["status"],
  tooth: dto.tooth || undefined,
  sourceEncounterId: dto.sourceEncounterId ?? undefined,
  sourceKey: dto.sourceKey ?? undefined,
  price: dto.price ?? undefined,
})

const toRequest = (values: TreatmentFormValues): TreatmentRequest => ({ ...values, description: values.description || null })

export const httpTreatmentsApi: TreatmentsApi = {
  async list(query, signal) {
    const page = await apiGet<Paginated<TreatmentDto>>("/treatments", { params: query, signal })
    return { ...page, items: page.items.map(toTreatment) }
  },
  async listActive(signal) {
    return (await apiGet<TreatmentDto[]>("/treatments", { params: { active: true }, signal })).map(toTreatment)
  },
  async get(id, signal) {
    return toTreatment(await apiGet<TreatmentDto>(`/treatments/${id}`, { signal }))
  },
  async create(values) {
    return toTreatment(await apiPost<TreatmentDto>("/treatments", toRequest(values)))
  },
  async update(id, values) {
    return toTreatment(await apiPut<TreatmentDto>(`/treatments/${id}`, toRequest(values)))
  },
  async remove(id) {
    await apiDelete(`/treatments/${id}`)
  },
  async listAssignments(treatmentId, signal) {
    return (await apiGet<TreatmentAssignmentDto[]>(`/treatments/${treatmentId}/assignments`, { signal })).map(toAssignment)
  },
  async listAssignmentsByPatient(patientId, signal) {
    return (await apiGet<TreatmentAssignmentDto[]>("/treatment-assignments", { params: { patientId }, signal })).map(toAssignment)
  },
  async createAssignment(input) {
    const body: CreateAssignmentRequest = { ...input, tooth: input.tooth || null }
    return toAssignment(await apiPost<TreatmentAssignmentDto>("/treatment-assignments", body))
  },
}
