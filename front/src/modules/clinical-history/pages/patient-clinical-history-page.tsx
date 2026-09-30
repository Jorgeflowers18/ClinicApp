import { useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { AlertCircle, ClipboardList, Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatient } from "@/modules/patients/api/patients.queries"

import { useDentalRecord } from "../api/clinical-history.queries"
import { StartVisitDialog } from "../components/start-visit-dialog"
import { VisitHeader } from "../components/visit-header"
import { VisitWorkspace } from "../components/visit-workspace"
import { findDraft, latestClosedVisit } from "../lib/visit"

/**
 * Historia clínica odontológica de un paciente. La visita mostrada se elige por `?visita=`, luego por
 * la cita de `?cita=`, luego el borrador en curso y por último la visita cerrada más reciente.
 */
export function PatientClinicalHistoryPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: patient, isLoading: patientLoading, error: patientError } = usePatient(patientId)
  const { data: record, isLoading: recordLoading, error: recordError, refetch } = useDentalRecord(patientId)
  const [startOpen, setStartOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  if (patientLoading || recordLoading) return <Skeleton className="h-96 w-full" />
  if (!patient || patientError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>No se pudo cargar el paciente</AlertTitle>
        <AlertDescription>{getErrorMessage(patientError ?? new Error("Paciente no encontrado"))}</AlertDescription>
      </Alert>
    )
  }
  if (!record || recordError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>No se pudo abrir la historia clínica</AlertTitle>
        <AlertDescription>{getErrorMessage(recordError)}</AlertDescription>
      </Alert>
    )
  }

  const visitParam = searchParams.get("visita")
  const appointmentParam = searchParams.get("cita")
  const draft = findDraft(record)
  const appointmentVisit = appointmentParam
    ? record.visits.find((visit) => visit.appointmentId === appointmentParam)
    : undefined
  const selected =
    record.visits.find((visit) => visit.id === visitParam) ?? appointmentVisit ?? draft ?? latestClosedVisit(record)
  // Una cita sin visita propone iniciar la visita, salvo que ya haya un borrador en curso.
  const appointmentPending = Boolean(appointmentParam && !appointmentVisit)

  function selectVisit(visitId: string) {
    setSearchParams({ visita: visitId })
  }

  function handleStartOpenChange(open: boolean) {
    setStartOpen(open)
    if (!open && appointmentParam) setSearchParams(visitParam ? { visita: visitParam } : {}, { replace: true })
  }

  async function reload() {
    await refetch()
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="min-w-0 space-y-5">
      <VisitHeader
        patient={patient}
        record={record}
        selectedVisitId={selected?.id}
        onSelectVisit={selectVisit}
        onNewVisit={() => setStartOpen(true)}
      />

      {appointmentPending && draft && (
        <Alert>
          <Info />
          <AlertTitle>Hay una visita en borrador</AlertTitle>
          <AlertDescription>
            Termina o descarta el borrador antes de iniciar la visita de esta cita. También puedes vincular la cita al
            borrador desde «Evolución y diagnóstico».
          </AlertDescription>
        </Alert>
      )}

      {selected ? (
        <VisitWorkspace
          key={`${selected.id}-${selected.status}-${reloadKey}`}
          patient={patient}
          record={record}
          visit={selected}
          onOpenVisit={selectVisit}
          onClosed={(visit) => selectVisit(visit.id)}
          onDiscarded={() => setSearchParams({})}
          onReload={() => void reload()}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <ClipboardList className="size-8" />
          <p className="font-medium text-foreground">Aún no hay visitas registradas</p>
          <p className="text-sm">Inicia la primera visita para registrar el odontograma, el diagnóstico y el plan de tratamiento.</p>
        </div>
      )}

      <StartVisitDialog
        open={startOpen || (appointmentPending && !draft)}
        onOpenChange={handleStartOpenChange}
        patientId={patient.id}
        record={record}
        appointmentId={appointmentParam}
        onStarted={(visit) => selectVisit(visit.id)}
      />
    </div>
  )
}
