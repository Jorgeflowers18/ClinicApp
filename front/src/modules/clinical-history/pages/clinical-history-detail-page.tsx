import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, FileText, Pencil } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/shared/components/page-header"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatient } from "@/modules/patients/api/patients.queries"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { useClinicalHistoryEntry } from "../api/clinical-history.queries"

export function ClinicalHistoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: entry, isLoading, isError, error } = useClinicalHistoryEntry(id)
  const { data: patient } = usePatient(entry?.patientId)
  const { data: professionals } = useProfessionals()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError || !entry) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo cargar el registro</AlertTitle>
        <AlertDescription>{getErrorMessage(error)}</AlertDescription>
      </Alert>
    )
  }

  const professionalName = professionals?.find((item) => item.id === entry.professionalId)?.name

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/historial-clinico")} className="mb-2 -ml-2">
          <ArrowLeft />
          Volver al historial
        </Button>
        <PageHeader
          title={patient ? `${patient.firstName} ${patient.lastName}` : "Registro clínico"}
          description={formatDateOnly(entry.date, { day: "2-digit", month: "long", year: "numeric" })}
          actions={
            <Button variant="outline" onClick={() => navigate(`/historial-clinico/${entry.id}/editar`)}>
              <Pencil />
              Editar
            </Button>
          }
        />
      </div>

      <Badge variant="outline" className="w-fit text-xs">
        Dato clínico sensible · acceso restringido por rol
      </Badge>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Motivo de consulta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{entry.reason}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{entry.diagnosis}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Notas de tratamiento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{entry.treatmentNotes || "Sin notas adicionales."}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Documentos adjuntos</CardTitle>
        </CardHeader>
        <CardContent>
          {entry.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin documentos adjuntos.</p>
          ) : (
            <ul className="space-y-2">
              {entry.attachments.map((name) => (
                <li key={name} className="flex items-center gap-2 text-sm">
                  <FileText className="size-4 text-muted-foreground" />
                  {name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Atendido por {professionalName ?? "profesional no especificado"}
      </p>
    </div>
  )
}
