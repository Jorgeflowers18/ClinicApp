import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { mockDelay, nextId, paginate } from "@/shared/lib/mock"
import { ApiError, type Paginated } from "@/shared/types/common"

import { mockPatients } from "./patients.mock-data"
import { formatClinicalRecordNumber, type Patient, type PatientFormValues, type PatientsQuery } from "../types/patient.types"
import { normalizeDocument, patientEditorSchema } from "../lib/patient-validation"

async function listMock(query: PatientsQuery): Promise<Paginated<Patient>> {
  await mockDelay()
  const search = query.search?.trim().toLowerCase()

  const simplify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const terms = simplify(search ?? "").split(/\s+/).filter(Boolean)
  const filtered = mockPatients.filter(patient => {
    const text = simplify([patient.firstName, patient.lastName, patient.documentId, patient.phone, patient.email].join(" "))
    const registered = new Date(patient.createdAt).toLocaleDateString("en-CA")
    return terms.every(term => text.includes(term)) && (!query.status || patient.treatmentStatus === query.status)
      && (!query.gender || patient.gender === query.gender)
      && (!query.registeredFrom || registered >= query.registeredFrom)
      && (!query.registeredTo || registered <= query.registeredTo)
  })

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
  validateValues(values)
  // El N.° de historia clínica es correlativo; con backend real lo asigna el servidor.
  const sequence = Math.max(0, ...mockPatients.map((item) => Number(item.clinicalRecordNumber.replace(/\D/g, "")) || 0)) + 1
  const patient: Patient = {
    ...values,
    id: nextId("pat"),
    clinicalRecordNumber: formatClinicalRecordNumber(sequence),
    createdAt: new Date().toISOString(),
  }
  mockPatients.unshift(patient)
  return patient
}

async function updateMock(id: string, values: PatientFormValues): Promise<Patient> {
  await mockDelay()
  const index = mockPatients.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Paciente no encontrado", 404)
  validateValues(values, id)
  // El N.° de historia clínica no se modifica.
  mockPatients[index] = { ...mockPatients[index], ...values, clinicalRecordNumber: mockPatients[index].clinicalRecordNumber }
  return mockPatients[index]
}

async function removeMock(id: string): Promise<void> {
  await mockDelay(300)
  const index = mockPatients.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Paciente no encontrado", 404)
  // Baja lógica: conserva todas las referencias a citas, historia clínica, tratamientos y pagos.
  mockPatients[index] = { ...mockPatients[index], treatmentStatus: "inactivo" }
}

function validateValues(values: PatientFormValues, id?: string) {
  const parsed = patientEditorSchema.safeParse(values)
  if (!parsed.success) throw new ApiError("Revisa los datos del paciente", 400, parsed.error.issues.map(issue => ({ field: issue.path.join("."), message: issue.message })))
  if (mockPatients.some(patient => patient.id !== id && normalizeDocument(patient.documentId) === normalizeDocument(values.documentId))) {
    throw new ApiError("Ya existe un paciente con ese documento", 409, [{ field: "documentId", message: "Ya existe un paciente con ese documento" }])
  }
}

// TODO: conectar a endpoint real -> GET /patients (API .NET), con query params page/pageSize/search
async function listReal(query: PatientsQuery): Promise<Paginated<Patient>> {
  const { data } = await http.get<Paginated<Patient>>("/patients", { params: query })
  return data
}

// TODO: conectar a endpoint real -> GET /patients/:id
async function getReal(id: string): Promise<Patient> {
  const { data } = await http.get<Patient>(`/patients/${id}`)
  return data
}

// TODO: conectar a endpoint real -> POST /patients (el servidor asigna clinicalRecordNumber)
async function createReal(values: PatientFormValues): Promise<Patient> {
  const { data } = await http.post<Patient>("/patients", values)
  return data
}

// TODO: conectar a endpoint real -> PUT /patients/:id (clinicalRecordNumber es de solo lectura)
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
