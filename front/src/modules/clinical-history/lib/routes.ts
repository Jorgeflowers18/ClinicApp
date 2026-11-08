export const clinicalHistoryPath = (patientId: string) => `/historial-clinico/paciente/${patientId}`

/** Página «Registrar atención»; con `appointmentId`, la cita queda precargada. */
export function registerEncounterPath(patientId: string, appointmentId?: string | null) {
  const path = `${clinicalHistoryPath(patientId)}/atencion/nueva`
  return appointmentId ? `${path}?cita=${encodeURIComponent(appointmentId)}` : path
}

export const encounterPath = (patientId: string, encounterId: string) =>
  `${clinicalHistoryPath(patientId)}?atencion=${encodeURIComponent(encounterId)}`
