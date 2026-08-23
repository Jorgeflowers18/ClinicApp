import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, CalendarDays, FileText, Pencil, Stethoscope } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/shared/components/page-header"
import { getErrorMessage } from "@/shared/lib/error-message"
import { calculateAge, formatDateOnly } from "@/shared/lib/date"
import { useAuthStore } from "@/modules/auth/store/auth-store"

import { usePatient } from "../api/patients.queries"

const GENDER_LABELS: Record<string, string> = {
  femenino: "Femenino",
  masculino: "Masculino",
  otro: "Otro",
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canSeeClinicalHistory = useAuthStore(
    (state) => state.user?.role === "admin" || state.user?.role === "medico"
  )
  const { data: patient, isLoading, isError, error } = usePatient(id)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError || !patient) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo cargar el paciente</AlertTitle>
        <AlertDescription>{getErrorMessage(error)}</AlertDescription>
      </Alert>
    )
  }

  const age = calculateAge(patient.birthDate)

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/pacientes")} className="mb-2 -ml-2">
          <ArrowLeft />
          Volver a pacientes
        </Button>
        <PageHeader
          title={`${patient.firstName} ${patient.lastName}`}
          description={`Cédula ${patient.documentId}${age !== null ? ` · ${age} años` : ""}`}
          actions={
            <Button variant="outline" onClick={() => navigate(`/pacientes/${patient.id}/editar`)}>
              <Pencil />
              Editar
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Información de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Teléfono</p>
              <p className="font-medium">{patient.phone}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Correo</p>
              <p className="font-medium">{patient.email || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dirección</p>
              <p className="font-medium">{patient.address || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Género</p>
              <p className="font-medium">{GENDER_LABELS[patient.gender]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha de nacimiento</p>
              <p className="font-medium">
                {formatDateOnly(patient.birthDate, { year: "numeric", month: "long", day: "2-digit" })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{patient.notes || "Sin notas registradas."}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="citas">
        <TabsList>
          <TabsTrigger value="citas">
            <CalendarDays />
            Citas
          </TabsTrigger>
          <TabsTrigger value="tratamientos">
            <Stethoscope />
            Tratamientos
          </TabsTrigger>
          {canSeeClinicalHistory && (
            <TabsTrigger value="historial">
              <FileText />
              Historial clínico
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="citas" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Citas agendadas para este paciente.
          </p>
          <Button variant="outline" onClick={() => navigate(`/citas?pacienteId=${patient.id}`)}>
            Ver citas en el calendario
          </Button>
        </TabsContent>

        <TabsContent value="tratamientos" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tratamientos asociados a este paciente.
          </p>
          <Button variant="outline" onClick={() => navigate(`/tratamientos?pacienteId=${patient.id}`)}>
            Ver tratamientos
          </Button>
        </TabsContent>

        {canSeeClinicalHistory && (
          <TabsContent value="historial" className="space-y-3">
            <Badge variant="outline" className="text-xs">
              Dato clínico sensible · acceso restringido por rol
            </Badge>
            <p className="text-sm text-muted-foreground">
              Consulta el historial clínico completo del paciente.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate(`/historial-clinico?pacienteId=${patient.id}`)}
            >
              Ver historial clínico
            </Button>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
