import { useNavigate } from "react-router-dom"
import { AlertCircle, Stethoscope } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { useClinicalHistory } from "../api/clinical-history.queries"
import { countPerformedTreatments, latestEncounter, resolveProfessionalName } from "../lib/record"
import { diagnosisSummary } from "../types/clinical-history.types"
import { MedicalAlerts } from "./medical-alerts"

const longDate = (value: string) => formatDateOnly(value, { day: "2-digit", month: "long", year: "numeric" })

/** Resumen de la historia clínica para la ficha del paciente. */
export function PatientClinicalSummary({ patientId }: { patientId: string }) {
  const navigate = useNavigate()
  const { data: history, isLoading, isError, error } = useClinicalHistory(patientId)
  const { data: professionals } = useProfessionals()

  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (isError || !history) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>No se pudo cargar la historia clínica</AlertTitle>
        <AlertDescription>{getErrorMessage(error)}</AlertDescription>
      </Alert>
    )
  }

  const last = latestEncounter(history.encounters)

  const items = [
    { label: "Atenciones registradas", value: String(history.encounters.length) },
    {
      label: "Última atención",
      value: last ? longDate(last.date) : "Sin atenciones",
      hint: last ? `${resolveProfessionalName(last, professionals)} · ${diagnosisSummary(last)}` : undefined,
    },
    { label: "Próximo control", value: last?.nextVisit ? longDate(last.nextVisit) : "Por definir" },
    { label: "Tratamientos realizados", value: String(countPerformedTreatments(history.encounters)) },
  ]

  return (
    <div className="space-y-4">
      <Badge variant="outline" className="text-xs">
        Dato clínico sensible · acceso restringido por rol
      </Badge>
      <MedicalAlerts source={history.record.allergiesAndMedication} />
      {history.record.medicalBackground.denies && (
        <p className="text-sm text-muted-foreground">Niega antecedentes médicos relevantes.</p>
      )}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="font-semibold">{item.value}</dd>
            {item.hint && <dd className="line-clamp-2 text-xs text-muted-foreground">{item.hint}</dd>}
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Los antecedentes, las alergias y los demás datos clínicos se editan en la historia clínica.
      </p>
      <Button onClick={() => navigate(`/historial-clinico/paciente/${patientId}`)}>
        <Stethoscope />
        Abrir historia clínica
      </Button>
    </div>
  )
}
