import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { mockDelay, nextId, paginate } from "@/shared/lib/mock"
import { ApiError, type PageQuery, type Paginated } from "@/shared/types/common"

import { mockPatients } from "./patients.mock-data"
import type { Patient, PatientFormValues } from "../types/patient.types"

async function listMock(query: PageQuery): Promise<Paginated<Patient>> {
  await mockDelay()
  const search = query.search?.trim().toLowerCase()

  const filtered = search
    ? mockPatients.filter((patient) =>
        [patient.firstName, patient.lastName, patient.documentId, patient.phone]
          .join(" ")
          .toLowerCase()
          .includes(search)
      )
    : mockPatients

  return paginate(
    [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    query
  )
}

async function getMock(id: string): Promise<Patient> {
  await mockDelay(250)
  const patient = mockPatients.find((item) => item.id === id)
  if (!patient) throw new ApiError("Paciente no encontrado", 404)
  return patient
}

async function createMock(values: PatientFormValues): Promise<Patient> {
  await mockDelay()
  const patient: Patient = { ...values, id: nextId("pat"), createdAt: new Date().toISOString() }
  mockPatients.unshift(patient)
  return patient
}

async function updateMock(id: string, values: PatientFormValues): Promise<Patient> {
  await mockDelay()
  const index = mockPatients.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Paciente no encontrado", 404)
  mockPatients[index] = { ...mockPatients[index], ...values }
  return mockPatients[index]
}

async function removeMock(id: string): Promise<void> {
  await mockDelay(300)
  const index = mockPatients.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Paciente no encontrado", 404)
  mockPatients.splice(index, 1)
}

// TODO: conectar a endpoint real -> GET /patients (API .NET), con query params page/pageSize/search
async function listReal(query: PageQuery): Promise<Paginated<Patient>> {
  const { data } = await http.get<Paginated<Patient>>("/patients", { params: query })
  return data
}

// TODO: conectar a endpoint real -> GET /patients/:id
async function getReal(id: string): Promise<Patient> {
  const { data } = await http.get<Patient>(`/patients/${id}`)
  return data
}

// TODO: conectar a endpoint real -> POST /patients
async function createReal(values: PatientFormValues): Promise<Patient> {
  const { data } = await http.post<Patient>("/patients", values)
  return data
}

// TODO: conectar a endpoint real -> PUT /patients/:id
async function updateReal(id: string, values: PatientFormValues): Promise<Patient> {
  const { data } = await http.put<Patient>(`/patients/${id}`, values)
  return data
}

// TODO: conectar a endpoint real -> DELETE /patients/:id
async function removeReal(id: string): Promise<void> {
  await http.delete(`/patients/${id}`)
}

export const patientsApi = {
  list: env.useMockApi ? listMock : listReal,
  get: env.useMockApi ? getMock : getReal,
  create: env.useMockApi ? createMock : createReal,
  update: env.useMockApi ? updateMock : updateReal,
  remove: env.useMockApi ? removeMock : removeReal,
}
