import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, CalendarDays, CreditCard, FileText, Pencil, ShieldCheck, Stethoscope, UserRound } from "lucide-react"

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
import { usePatientFinancialSummary } from "@/modules/finance/api/finance.queries"

import { usePatient } from "../api/patients.queries"
import { treatmentStatusLabels } from "../types/patient.types"

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
  const { data: financialSummary } = usePatientFinancialSummary(id)

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
            <div className="flex flex-wrap gap-2">
            {canSeeClinicalHistory && <Button onClick={() => navigate(`/historial-clinico/paciente/${patient.id}/odontologia`)}>
              <Stethoscope /> Historia odontológica
            </Button>}
            <Button variant="outline" onClick={() => navigate(`/pacientes/${patient.id}/editar`)}>
              <Pencil />
              Editar
            </Button>
            </div>
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
            <CardTitle className="text-sm text-muted-foreground">Estado y observaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{treatmentStatusLabels[patient.treatmentStatus ?? "activo"]}</Badge>
              <Badge variant={patient.notificationsEnabled ? "default" : "outline"}>
                {patient.notificationsEnabled ? "Notificaciones activadas" : "Notificaciones desactivadas"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Notas de atención</p>
              <p>{patient.notes || "Sin notas registradas."}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Última visita</p>
              <p>{patient.lastVisitAt ? formatDateOnly(patient.lastVisitAt) : "Sin registro"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserRound className="size-4" />
              Historial médico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">Antecedentes</p>
            <p>{patient.medicalHistory || "Sin antecedentes médicos registrados."}</p>
            <p className="font-medium">Alergias</p>
            <p>{patient.allergies || "Sin alergias registradas."}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4" />
              Emergencia y seguro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground">Contacto</p>
              <p className="font-medium">{patient.emergencyContactName || "—"}</p>
              <p>{patient.emergencyContactPhone || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Seguro / convenio</p>
              <p className="font-medium">{patient.insuranceProvider || "—"}</p>
              <p>{patient.insurancePolicy || "—"}</p>
            </div>
            <p className="text-muted-foreground">Consentimiento informado</p>
            <p>{patient.consentSigned ? "Firmado" : "No firmado"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="size-4" />
              Documentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">Historial del paciente</p>
            <p>{patient.medicalHistory ? "Documentación clínica disponible" : "Sin documentación clínica registrada"}</p>
            <p className="font-medium">Consentimientos</p>
            <p>{patient.consentSigned ? "Consentimiento firmado" : "Consentimiento pendiente"}</p>
            <p className="font-medium">Notificaciones</p>
            <p>{patient.notificationsEnabled ? "Habilitadas" : "Deshabilitadas"}</p>
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
          <TabsTrigger value="finanzas">
            <CreditCard />
            Finanzas
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

        <TabsContent value="finanzas" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total tratamientos</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{financialSummary?.totalTreatments ?? 0}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total pagado</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">${(financialSummary?.totalPaid ?? 0).toFixed(2)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total pendiente</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">${(financialSummary?.totalPending ?? 0).toFixed(2)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total vencido</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">${(financialSummary?.totalOverdue ?? 0).toFixed(2)}</CardContent>
            </Card>
          </div>
          <Button variant="outline" onClick={() => navigate("/finanzas")}>Ver cartera financiera</Button>
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
            <Button onClick={() => navigate(`/historial-clinico/paciente/${patient.id}/odontologia`)}>
              <Stethoscope /> Odontograma y tratamiento odontológico
            </Button>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
