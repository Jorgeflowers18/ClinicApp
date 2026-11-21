import type { components } from "@/shared/api/schema"
import { apiDelete, apiGet, apiPost, apiPut } from "@/shared/lib/http"
import type { Paginated } from "@/shared/types/common"

import type { PatientsApi } from "./patients.contract"
import type { Patient, PatientFormValues } from "../types/patient.types"

type PatientDto = components["schemas"]["PatientDto"]
type PatientRequest = components["schemas"]["PatientRequest"]

/** Los textos de la API son los mismos valores que las uniones del frontend (la API los valida). */
export const toPatient = (dto: PatientDto): Patient => ({
  ...dto,
  documentType: (dto.documentType ?? undefined) as Patient["documentType"],
  gender: dto.gender as Patient["gender"],
  maritalStatus: dto.maritalStatus as Patient["maritalStatus"],
  treatmentStatus: dto.treatmentStatus as Patient["treatmentStatus"],
})

const toRequest = (values: PatientFormValues): PatientRequest => ({ ...values, documentType: values.documentType ?? null })

export const httpPatientsApi: PatientsApi = {
  async list(query, signal) {
    const page = await apiGet<Paginated<PatientDto>>("/patients", { params: query, signal })
    return { ...page, items: page.items.map(toPatient) }
  },
  async get(id, signal) {
    return toPatient(await apiGet<PatientDto>(`/patients/${id}`, { signal }))
  },
  async create(values) {
    return toPatient(await apiPost<PatientDto>("/patients", toRequest(values)))
  },
  async update(id, values) {
    return toPatient(await apiPut<PatientDto>(`/patients/${id}`, toRequest(values)))
  },
  async remove(id) {
    await apiDelete(`/patients/${id}`)
  },
  async restore(id) {
    return toPatient(await apiPost<PatientDto>(`/patients/${id}/restore`))
  },
}
