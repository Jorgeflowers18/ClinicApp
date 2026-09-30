import { useNavigate } from "react-router-dom"
import { AlertCircle, Stethoscope } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { useDentalRecord } from "../api/clinical-history.queries"
import { closedVisits, findDraft, resolveProfessionalName } from "../lib/visit"

const longDate = (value: string) => formatDateOnly(value, { day: "2-digit", month: "long", year: "numeric" })

/** Resumen de la historia clínica para la ficha del paciente. */
export function PatientClinicalSummary({ patientId }: { patientId: string }) {
  const navigate = useNavigate()
  const { data: record, isLoading, isError, error } = useDentalRecord(patientId)
  const { data: professionals } = useProfessionals()

  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (isError || !record) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>No se pudo cargar la historia clínica</AlertTitle>
        <AlertDescription>{getErrorMessage(error)}</AlertDescription>
      </Alert>
    )
  }

  const closed = closedVisits(record)
  const last = closed.at(-1)
  const draft = findDraft(record)

  const items = [
    { label: "Visitas cerradas", value: String(closed.length) },
    {
      label: "Última visita",
      value: last ? longDate(last.date) : "Sin visitas",
      hint: last ? `${resolveProfessionalName(last, professionals)} · ${last.diagnosis}` : undefined,
    },
    { label: "Próximo control", value: last?.nextVisit ? longDate(last.nextVisit) : "Por definir" },
    { label: "Visita en borrador", value: draft ? `Sí, del ${longDate(draft.date)}` : "No" },
  ]

  return (
    <div className="space-y-4">
      <Badge variant="outline" className="text-xs">
        Dato clínico sensible · acceso restringido por rol
      </Badge>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="font-semibold">{item.value}</dd>
            {item.hint && <dd className="line-clamp-2 text-xs text-muted-foreground">{item.hint}</dd>}
          </div>
        ))}
      </dl>
      <Button onClick={() => navigate(`/historial-clinico/paciente/${patientId}`)}>
        <Stethoscope />
        Abrir historia clínica
      </Button>
    </div>
  )
}
