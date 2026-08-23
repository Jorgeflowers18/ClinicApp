import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { mockDelay, nextId, paginate } from "@/shared/lib/mock"
import { ApiError, type PageQuery, type Paginated } from "@/shared/types/common"

import { mockClinicalHistory } from "./clinical-history.mock-data"
import type { ClinicalHistoryEntry, ClinicalHistoryFormValues } from "../types/clinical-history.types"

interface ClinicalHistoryQuery extends PageQuery {
  patientId?: string
}

async function listMock(query: ClinicalHistoryQuery): Promise<Paginated<ClinicalHistoryEntry>> {
  await mockDelay()
  const search = query.search?.trim().toLowerCase()

  let filtered = mockClinicalHistory
  if (query.patientId) {
    filtered = filtered.filter((entry) => entry.patientId === query.patientId)
  }
  if (search) {
    filtered = filtered.filter((entry) =>
      [entry.reason, entry.diagnosis].join(" ").toLowerCase().includes(search)
    )
  }

  return paginate([...filtered].sort((a, b) => b.date.localeCompare(a.date)), query)
}

async function getMock(id: string): Promise<ClinicalHistoryEntry> {
  await mockDelay(250)
  const entry = mockClinicalHistory.find((item) => item.id === id)
  if (!entry) throw new ApiError("Registro no encontrado", 404)
  return entry
}

async function createMock(values: ClinicalHistoryFormValues): Promise<ClinicalHistoryEntry> {
  await mockDelay()
  const entry: ClinicalHistoryEntry = { ...values, id: nextId("hist"), createdAt: new Date().toISOString() }
  mockClinicalHistory.unshift(entry)
  return entry
}

async function updateMock(id: string, values: ClinicalHistoryFormValues): Promise<ClinicalHistoryEntry> {
  await mockDelay()
  const index = mockClinicalHistory.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Registro no encontrado", 404)
  mockClinicalHistory[index] = { ...mockClinicalHistory[index], ...values }
  return mockClinicalHistory[index]
}

// TODO: conectar a endpoint real -> GET /clinical-history (requiere autorización por rol en el backend)
async function listReal(query: ClinicalHistoryQuery): Promise<Paginated<ClinicalHistoryEntry>> {
  const { data } = await http.get<Paginated<ClinicalHistoryEntry>>("/clinical-history", { params: query })
  return data
}

// TODO: conectar a endpoint real -> GET /clinical-history/:id
async function getReal(id: string): Promise<ClinicalHistoryEntry> {
  const { data } = await http.get<ClinicalHistoryEntry>(`/clinical-history/${id}`)
  return data
}

// TODO: conectar a endpoint real -> POST /clinical-history
async function createReal(values: ClinicalHistoryFormValues): Promise<ClinicalHistoryEntry> {
  const { data } = await http.post<ClinicalHistoryEntry>("/clinical-history", values)
  return data
}

// TODO: conectar a endpoint real -> PUT /clinical-history/:id
async function updateReal(id: string, values: ClinicalHistoryFormValues): Promise<ClinicalHistoryEntry> {
  const { data } = await http.put<ClinicalHistoryEntry>(`/clinical-history/${id}`, values)
  return data
}

export const clinicalHistoryApi = {
  list: env.useMockApi ? listMock : listReal,
  get: env.useMockApi ? getMock : getReal,
  create: env.useMockApi ? createMock : createReal,
  update: env.useMockApi ? updateMock : updateReal,
}
