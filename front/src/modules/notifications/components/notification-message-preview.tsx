import { useMemo, useState } from "react"
import { addDays, format } from "date-fns"
import { Link } from "react-router-dom"
import { Eye, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { SearchInput } from "@/shared/components/search-input"
import { env } from "@/shared/lib/env"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { InstitutionMark } from "@/modules/institution/components/institution-brand"
import { useInstitutionProfile, useSavedInstitutionName } from "@/modules/institution/hooks/use-institution-profile"
import { useAppointmentsList, useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { appointmentStatusLabels } from "@/modules/appointments/types/appointment.types"
import { usePatient } from "@/modules/patients/api/patients.queries"
import { useMessagingCatalog } from "../hooks/use-messaging-catalog"
import { appointmentDateTime, hasActiveAppointmentStatus, resolveAppointmentMessage, resolveExampleMessage, type MessageIssue } from "../lib/message-template"

function MessageIssues({ issues, patientId }: { issues: MessageIssue[]; patientId?: string }) {
  const admin = useAuthStore(state => state.user?.role === "admin")
  if (!issues.length) return null
  return <div className="messaging-context-issues" role="status">
    <ul>{issues.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul>
    {issues.some(issue => issue.field === "institutionName") && (admin
      ? <Link to="/perfil-institucion">Configurar Perfil institucional</Link>
      : <p>Solicita al administrador que configure el nombre institucional.</p>)}
    {issues.some(issue => ["professionalId", "start", "patientId"].includes(issue.field)) && <Link to={patientId ? `/citas?pacienteId=${encodeURIComponent(patientId)}` : "/citas"}>Revisar la cita en el calendario</Link>}
  </div>
}

function AppointmentMessagePreview({ message, institutionName, selectedId, onSelect }: {
  message: string; institutionName: string | null; selectedId: string; onSelect: (id: string) => void
}) {
  // Con la API, solo las citas de hoy a 30 días (no la agenda completa); la demostración las tiene todas en memoria.
  const range = useMemo(() => env.usesApi("agenda") ? { from: format(new Date(), "yyyy-MM-dd"), to: format(addDays(new Date(), 30), "yyyy-MM-dd") } : undefined, [])
  const appointments = useAppointmentsList(range), professionals = useProfessionals()
  const { patients } = useMessagingCatalog()
  const [search, setSearch] = useState("")
  const records = appointments.data ?? []
  const appointment = records.find(item => item.id === selectedId)
  const selectedPatient = usePatient(appointment?.patientId)
  const names = new Map((patients.data ?? []).map(patient => [patient.id, `${patient.firstName} ${patient.lastName}`.trim()]))
  const items = Object.fromEntries(records.map(item => {
    const date = appointmentDateTime(item.start)
    return [item.id, `${item.patientName || names.get(item.patientId) || "Paciente no disponible"} · ${date ? `${date.date} · ${date.time}` : "Fecha no disponible"}`]
  }))
  const filtered = records.filter(item => `${items[item.id]} ${item.id}`.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .includes(search.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()))
  const professional = professionals.data?.find(item => item.id === appointment?.professionalId)
  const result = resolveAppointmentMessage(message, { institutionName, appointment, patient: selectedPatient.data, professional })
  const loading = appointments.isPending || patients.isLoading || professionals.isPending || Boolean(appointment && selectedPatient.isPending)
  const failed = appointments.isError || patients.isError || professionals.isError || Boolean(appointment && selectedPatient.isError)
  const refreshing = appointments.isFetching || professionals.isFetching || Boolean(appointment && selectedPatient.isFetching)
  return <>
    <div className="messaging-preview-controls">
      <SearchInput ariaLabel="Buscar cita por paciente o fecha" placeholder="Buscar por paciente o fecha…" value={search} onChange={setSearch} />
      <div><Label htmlFor="message-preview-appointment">Cita</Label>
        <Select items={items} value={appointment?.id ?? null} onValueChange={value => onSelect(value ?? "")} disabled={appointments.isPending || patients.isPending}>
          <SelectTrigger id="message-preview-appointment" className="w-full"><SelectValue placeholder="Selecciona una cita" /></SelectTrigger>
          <SelectContent align="start">{filtered.map(item => <SelectItem key={item.id} value={item.id}>{items[item.id]}</SelectItem>)}
            {!filtered.length && <p className="px-2 py-2 text-sm text-muted-foreground">No hay citas coincidentes.</p>}
          </SelectContent>
        </Select>
      </div>
    </div>
    {failed ? <div className="messaging-context-issues" role="status"><p>No se pudieron actualizar los datos de la cita. La vista previa no está disponible.</p>
      <Button type="button" size="sm" variant="outline" onClick={() => { void appointments.refetch(); void professionals.refetch(); void patients.refetch(); if (appointment) void selectedPatient.refetch() }}>Reintentar consulta</Button>
    </div> : loading ? <Skeleton className="h-24 w-full" aria-label="Cargando datos de la cita" /> : !appointment ? <p className="messaging-hint">{selectedId ? "La cita seleccionada ya no está disponible. Selecciona otra cita." : "Selecciona una cita para generar la vista previa con sus datos."}</p> : <>
      <dl className="messaging-appointment-context">
        <div><dt>Paciente</dt><dd>{selectedPatient.data ? `${selectedPatient.data.firstName} ${selectedPatient.data.lastName}` : "Paciente no disponible"}</dd></div>
        <div><dt>Profesional</dt><dd>{professional?.name || "Profesional pendiente de asignación"}</dd></div>
        <div><dt>Fecha y hora</dt><dd>{appointmentDateTime(appointment.start)?.date ?? "Fecha no disponible"} · {appointmentDateTime(appointment.start)?.time ?? "Hora no disponible"}</dd></div>
        <div><dt>Estado de la cita</dt><dd>{appointmentStatusLabels[appointment.status]}</dd></div>
      </dl>
      <p className="messaging-preview-body" data-message-body>{result.message}</p>
      {!hasActiveAppointmentStatus(appointment) && <p className="messaging-context-issues">Esta cita no está activa para recordatorios. Sus datos se muestran como consulta.</p>}
      <MessageIssues issues={result.issues} patientId={appointment.patientId} />
      {!selectedPatient.data?.notificationsEnabled && <p className="messaging-hint">El paciente tiene las notificaciones deshabilitadas.</p>}
    </>}
    <div className="messaging-preview-refresh">
      {refreshing && <span className="messaging-hint" role="status">Actualizando datos de la cita…</span>}
      <Button type="button" variant="ghost" size="sm" disabled={refreshing} onClick={() => { void appointments.refetch(); void professionals.refetch(); void patients.refetch(); if (appointment) void selectedPatient.refetch() }}><RefreshCw aria-hidden="true" />Actualizar datos</Button>
    </div>
  </>
}

export function NotificationMessagePreview({ message }: { message: string }) {
  const institution = useInstitutionProfile()
  const institutionName = useSavedInstitutionName()
  const [mode, setMode] = useState("example"), [appointmentId, setAppointmentId] = useState("")
  const example = resolveExampleMessage(message, institutionName)
  return <section className="messaging-preview" aria-label="Vista previa del mensaje">
    <div className="messaging-preview-heading"><Eye aria-hidden="true" /><h3>Vista previa</h3><Badge variant="secondary">{mode === "example" ? "Datos de ejemplo" : "Cita existente"}</Badge></div>
    <div className="messaging-preview-controls"><Label htmlFor="message-preview-mode">Vista previa con:</Label>
      <Select items={{ example: "Datos de ejemplo", appointment: "Cita existente" }} value={mode} onValueChange={value => setMode(value ?? "example")}>
        <SelectTrigger id="message-preview-mode" className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="example">Datos de ejemplo</SelectItem><SelectItem value="appointment">Cita existente</SelectItem></SelectContent>
      </Select>
    </div>
    <div className="messaging-preview-brand"><InstitutionMark name={institutionName ?? ""} image={institution.logoImage} /><span>{institutionName ?? "Nombre institucional sin configurar"}</span></div>
    {!institutionName && <MessageIssues issues={[{ field: "institutionName", message: "Configura el nombre de la institución en Perfil institucional para usar la variable Clínica." }]} />}
    {mode === "example" ? <>
      <p className="messaging-preview-body" data-message-body>{example.message}</p>
      <MessageIssues issues={example.issues.filter(issue => issue.field !== "institutionName")} />
    </> : <AppointmentMessagePreview message={message} institutionName={institutionName} selectedId={appointmentId} onSelect={setAppointmentId} />}
    <p className="messaging-hint">{mode === "example" ? "Paciente, fecha y profesional de ejemplo. " : !env.usesApi("agenda") ? "Cita del entorno de demostración. " : ""}Esta vista previa no envía mensajes.</p>
  </section>
}
