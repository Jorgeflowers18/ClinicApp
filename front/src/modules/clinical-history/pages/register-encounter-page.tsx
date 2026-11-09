import { useParams, useSearchParams } from "react-router-dom"
import { AlertCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatient } from "@/modules/patients/api/patients.queries"

import { useClinicalHistory } from "../api/clinical-history.queries"
import { RegisterEncounterForm } from "../components/register-encounter-form"

/** Página «Registrar atención» (`/historial-clinico/paciente/:patientId/atencion/nueva`). `?cita=` precarga la cita. */
export function RegisterEncounterPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const [searchParams] = useSearchParams()
  const { data: patient, isLoading: patientLoading, error: patientError } = usePatient(patientId)
  const { data: history, isLoading: historyLoading, error: historyError } = useClinicalHistory(patientId)

  if (patientLoading || historyLoading) return <Skeleton className="h-96 w-full" />
  if (!patient || patientError || !history || historyError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>No se pudo abrir «Registrar atención»</AlertTitle>
        <AlertDescription>{getErrorMessage(patientError ?? historyError ?? new Error("Paciente no encontrado"))}</AlertDescription>
      </Alert>
    )
  }

  return <RegisterEncounterForm patient={patient} history={history} appointmentId={searchParams.get("cita")} />
}
