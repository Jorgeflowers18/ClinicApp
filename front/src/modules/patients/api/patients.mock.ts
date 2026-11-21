import { mockDelay, nextId, paginate } from "@/shared/lib/mock"
import { ApiError } from "@/shared/types/common"

import type { PatientsApi } from "./patients.contract"
import { mockPatients } from "./patients.mock-data"
import { formatClinicalRecordNumber, type Patient, type PatientFormValues } from "../types/patient.types"
import { normalizeDocument, patientEditorSchema } from "../lib/patient-validation"

const simplify = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

function find(id: string): number {
  const index = mockPatients.findIndex((item) => item.id === id)
  if (index === -1) throw new ApiError("Paciente no encontrado", 404)
  return index
}

function validateValues(values: PatientFormValues, id?: string) {
  const parsed = patientEditorSchema.safeParse(values)
  if (!parsed.success) throw new ApiError("Revisa los datos del paciente", 400, parsed.error.issues.map(issue => ({ field: issue.path.join("."), message: issue.message })))
  if (mockPatients.some(patient => patient.id !== id && normalizeDocument(patient.documentId) === normalizeDocument(values.documentId))) {
    throw new ApiError("Ya existe un paciente con ese documento", 409, [{ field: "documentId", message: "Ya existe un paciente con ese documento" }])
  }
}

export const mockPatientsApi: PatientsApi = {
  async list(query) {
    await mockDelay()
    const terms = simplify(query.search?.trim() ?? "").split(/\s+/).filter(Boolean)
    const filtered = mockPatients.filter(patient => {
      const text = simplify([patient.firstName, patient.lastName, patient.documentId, patient.phone, patient.email, patient.clinicalRecordNumber].join(" "))
      const registered = new Date(patient.createdAt).toLocaleDateString("en-CA")
      return Boolean(query.deleted) === Boolean(patient.deletedAt)
        && terms.every(term => text.includes(term)) && (!query.status || patient.treatmentStatus === query.status)
        && (!query.gender || patient.gender === query.gender)
        && (!query.registeredFrom || registered >= query.registeredFrom)
        && (!query.registeredTo || registered <= query.registeredTo)
    })
    // Como el servidor: los dados de baja, del más reciente en darse de baja al más antiguo.
    const order = query.deleted
      ? (a: Patient, b: Patient) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "")
      : (a: Patient, b: Patient) => b.createdAt.localeCompare(a.createdAt)
    return paginate([...filtered].sort(order), query)
  },
  async get(id) {
    await mockDelay(250)
    return mockPatients[find(id)]
  },
  async create(values) {
    await mockDelay()
    validateValues(values)
    // El N.° de historia clínica es correlativo; con la API lo asigna el servidor.
    const sequence = Math.max(0, ...mockPatients.map((item) => Number(item.clinicalRecordNumber.replace(/\D/g, "")) || 0)) + 1
    const patient: Patient = {
      ...values,
      id: nextId("pat"),
      clinicalRecordNumber: formatClinicalRecordNumber(sequence),
      createdAt: new Date().toISOString(),
      deletedAt: null,
    }
    mockPatients.unshift(patient)
    return patient
  },
  async update(id, values) {
    await mockDelay()
    const index = find(id)
    if (mockPatients[index].deletedAt) throw new ApiError("El paciente está dado de baja. Reactívalo para editarlo.", 409)
    validateValues(values, id)
    // El N.° de historia clínica no se modifica.
    mockPatients[index] = { ...mockPatients[index], ...values, clinicalRecordNumber: mockPatients[index].clinicalRecordNumber }
    return mockPatients[index]
  },
  async remove(id) {
    await mockDelay(300)
    const index = find(id)
    // Baja lógica: conserva todas las referencias a citas, historia clínica, tratamientos y pagos.
    mockPatients[index] = { ...mockPatients[index], deletedAt: new Date().toISOString() }
  },
  async restore(id) {
    await mockDelay(300)
    const index = find(id)
    mockPatients[index] = { ...mockPatients[index], deletedAt: null }
    return mockPatients[index]
  },
}
