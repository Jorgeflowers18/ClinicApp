import { z } from "zod"

import { patientSchema, toPatientFormValues, type Patient, type PatientFormValues } from "@/modules/patients/types/patient.types"

const shape = patientSchema.shape

/**
 * «Datos del Cliente» del formulario en papel que se editan desde la historia. Es el mismo registro
 * del paciente (módulo Pacientes): lo que se cambia aquí se ve en la ficha del paciente y viceversa.
 */
export const patientDataSchema = z.object({
  firstName: shape.firstName,
  lastName: shape.lastName,
  documentId: shape.documentId,
  birthDate: shape.birthDate,
  gender: shape.gender,
  maritalStatus: shape.maritalStatus.removeDefault(),
  occupation: shape.occupation.removeDefault(),
  company: shape.company.removeDefault(),
  nationality: shape.nationality.removeDefault(),
  address: shape.address.removeDefault(),
  city: shape.city.removeDefault(),
  phone: shape.phone,
  email: shape.email.removeDefault(),
  emergencyContactName: shape.emergencyContactName.removeDefault(),
  emergencyContactRelationship: shape.emergencyContactRelationship.removeDefault(),
  emergencyContactPhone: shape.emergencyContactPhone.removeDefault(),
})

export type PatientDataValues = z.infer<typeof patientDataSchema>

const patientDataKeys = Object.keys(patientDataSchema.shape) as (keyof PatientDataValues)[]

export function pickPatientData(patient: Patient): PatientDataValues {
  const values = toPatientFormValues(patient)
  return Object.fromEntries(patientDataKeys.map((key) => [key, values[key]])) as PatientDataValues
}

/** Datos completos para guardar el paciente: lo que no se edita en la historia queda como estaba. */
export function mergePatientData(patient: Patient, data: PatientDataValues): PatientFormValues {
  return { ...toPatientFormValues(patient), ...data }
}
