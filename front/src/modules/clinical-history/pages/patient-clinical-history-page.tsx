import { useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { AlertCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatient } from "@/modules/patients/api/patients.queries"

import { useClinicalHistory } from "../api/clinical-history.queries"
import { RecordWorkspace, type RecordTab } from "../components/record-workspace"

/**
 * Historia clínica odontológica de un paciente, editable al abrirla. `?atencion=` abre el historial
 * en esa atención; `?visita=` (enlaces anteriores) se trata igual, porque las visitas convertidas
 * conservan su id. `?cita=` (desde la agenda) abre la atención de esa cita o, si aún no tiene, abre
 * «Registrar atención» con la cita preseleccionada.
 */
export function PatientClinicalHistoryPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: patient, isLoading: patientLoading, error: patientError } = usePatient(patientId)
  const { data: history, isLoading: historyLoading, error: historyError, refetch } = useClinicalHistory(patientId)
  const [mountKey, setMountKey] = useState(0)
  // Pestaña en la que se vuelve a montar la historia tras descartar o recargar.
  const [resumeTab, setResumeTab] = useState<RecordTab | null>(null)

  if (patientLoading || historyLoading) return <Skeleton className="h-96 w-full" />
  if (!patient || patientError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>No se pudo cargar el paciente</AlertTitle>
        <AlertDescription>{getErrorMessage(patientError ?? new Error("Paciente no encontrado"))}</AlertDescription>
      </Alert>
    )
  }
  if (!history || historyError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>No se pudo abrir la historia clínica</AlertTitle>
        <AlertDescription>{getErrorMessage(historyError)}</AlertDescription>
      </Alert>
    )
  }

  const appointmentParam = searchParams.get("cita")
  const appointmentEncounter = appointmentParam
    ? history.encounters.find((encounter) => encounter.appointmentId === appointmentParam)
    : undefined
  const encounterParam = searchParams.get("atencion") ?? searchParams.get("visita") ?? appointmentEncounter?.id ?? null
  const highlighted = history.encounters.some((encounter) => encounter.id === encounterParam) ? encounterParam : null

  function remount(tab: RecordTab) {
    setResumeTab(tab)
    setMountKey((key) => key + 1)
  }

  async function reload(tab: RecordTab) {
    await refetch()
    remount(tab)
  }

  return (
    <RecordWorkspace
      key={mountKey}
      patient={patient}
      history={history}
      initialTab={resumeTab ?? (highlighted ? "atenciones" : "odontograma")}
      highlightedEncounterId={highlighted}
      onReset={remount}
      onReload={(tab) => void reload(tab)}
      pendingAppointmentId={appointmentParam && !appointmentEncounter ? appointmentParam : null}
      onAppointmentHandled={() => setSearchParams({}, { replace: true })}
      onShowEncounter={(encounterId) => setSearchParams({ atencion: encounterId }, { replace: true })}
    />
  )
}
