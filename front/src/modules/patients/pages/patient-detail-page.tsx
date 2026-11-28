import { useState, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Archive, FolderOpen, ArrowLeft, Bell, BriefcaseBusiness, Building2, CalendarDays, CalendarPlus, ClipboardList, FileText, Globe, Heart, Mail, MapPin, MessageSquare, Pencil, Phone, ShieldCheck, Stethoscope, UserRound, Wallet, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SectionNavigationPanel } from "@/shared/components/section-navigation"
import { useSectionQueryState } from "@/shared/hooks/use-section-query-state"
import { formatDateOnly, formatDateTime } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { PatientClinicalSummary } from "@/modules/clinical-history/components/patient-clinical-summary"
import { AppointmentFormDialog } from "@/modules/appointments/components/appointment-form-dialog"
import { usePatient, useRestorePatient } from "../api/patients.queries"
import { genderLabels, maritalStatusLabels } from "../types/patient.types"
import { PatientInitials, PatientStatus } from "../components/patient-status"
import { PatientActions, PatientActionsProvider } from "../components/patient-actions"
import { PatientAppointments, PatientDocuments, PatientFinances, PatientTreatments } from "../components/patient-related-tabs"
import { documentTypes, patientAge } from "../lib/patient-validation"
import { usePatientLastVisit } from "../hooks/use-patient-last-visit"
import { PatientEmptyState, PatientSectionCard, PatientStateBadge, PatientTabs } from "../components/patient-ui"
import { PatientFormDialog } from "../components/patient-form-dialog"

function Information({ items }: { items: [string, ReactNode, LucideIcon][] }) {
  return <dl className="patient-information">{items.map(([label, value, Icon]) => <div key={label}><Icon aria-hidden="true" /><div><dt>{label}</dt><dd>{value || "No registrado"}</dd></div></div>)}</dl>
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const role = useAuthStore(state => state.user?.role)
  const clinical = role === "admin" || role === "medico"
  const query = usePatient(id)
  const restore = useRestorePatient()
  const lastVisit = usePatientLastVisit(id)
  const sections = [
    { value: "resumen", title: "Resumen", description: "Datos y seguimiento del paciente", icon: UserRound },
    { value: "citas", title: "Citas", description: "Agenda e historial de citas", icon: CalendarDays },
    ...(clinical ? [{ value: "historial", title: "Historial clínico", description: "Atenciones y antecedentes clínicos", icon: ClipboardList }] : []),
    { value: "tratamientos", title: "Tratamientos", description: "Procedimientos y evolución", icon: Stethoscope },
    // Finanzas: solo admin y recepción (el médico recibe 403 de la API).
    ...(role === "admin" || role === "recepcion" ? [{ value: "finanzas", title: "Finanzas", description: "Pagos y saldos del paciente", icon: Wallet }] : []),
    { value: "documentos", title: "Archivo clínico", description: "Fotografías, estudios y documentos", icon: FolderOpen },
  ]
  const [section, setSection] = useSectionQueryState(sections, "resumen")
  const [scheduling, setScheduling] = useState(false)
  const [editing, setEditing] = useState<{ section?: string; trigger: HTMLElement | null } | null>(null)
  if (query.isLoading) return <div className="patient-detail space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>
  if (query.isError || !query.data) return <div role="alert" className="patient-source-error"><p>No se pudo cargar el paciente.</p><Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div>
  const patient = query.data
  // Dado de baja: se consulta, pero no se edita ni se agenda (el servidor responde 409) hasta reactivarlo.
  const removed = Boolean(patient.deletedAt)
  const age = patientAge(patient.birthDate)
  async function reactivate() {
    try {
      await restore.mutateAsync(patient.id)
      toast.success("Paciente reactivado")
    } catch (error) { toast.error(getErrorMessage(error)) }
  }
  const editSection = (target: string, label: string) => removed ? undefined : <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" aria-label={`Editar ${label}`} onClick={event => setEditing({ section: target, trigger: event.currentTarget })}><Pencil aria-hidden="true" /></Button>} /><TooltipContent>{`Editar ${label}`}</TooltipContent></Tooltip>
  return <PatientActionsProvider><div className="patient-detail space-y-4">
    <Button variant="ghost" size="sm" onClick={() => navigate("/pacientes")}><ArrowLeft />Volver a pacientes</Button>
    <header className="patient-profile-header">
      <div className="patient-profile-identity"><PatientInitials patient={patient} /><div><h1>{patient.firstName} {patient.lastName}</h1><p>{documentTypes.find(item => item.value === patient.documentType)?.label ?? "Documento"} {patient.documentId}{age !== null && ` · ${age} ${age === 1 ? "año" : "años"}`} · {patient.clinicalRecordNumber}</p><PatientStatus status={patient.treatmentStatus} /></div></div>
      {!removed && <div className="patient-profile-actions"><Button variant="outline" onClick={event => setEditing({ trigger: event.currentTarget })}><Pencil />Editar</Button><Button onClick={() => setScheduling(true)}><CalendarPlus />Agendar cita</Button><PatientActions patient={patient} allowRemoval onSchedule={() => setScheduling(true)} onEdit={trigger => setEditing({ trigger })} /></div>}
    </header>
    {removed && <div role="status" className="patient-removed-notice">
      <p><Archive aria-hidden="true" /><span><strong>Paciente dado de baja</strong> el {formatDateTime(patient.deletedAt!, { year: "numeric", month: "long", day: "2-digit" })}. Sus registros se conservan; para editarlo o agendarle citas, un administrador debe reactivarlo.</span></p>
      {role === "admin" && <Button variant="outline" disabled={restore.isPending} onClick={() => { void reactivate() }}><UserRound />Reactivar paciente</Button>}
    </div>}
    <PatientTabs key={patient.id} label="Secciones del paciente" value={section} onValueChange={setSection} items={sections}>
      <SectionNavigationPanel value="resumen"><div className="patient-information-grid">
        <PatientSectionCard title="Información de contacto" icon={Phone} action={editSection("contact", "información de contacto")}><Information items={[["Teléfono", patient.phone, Phone], ["Correo", patient.email, Mail], ["Dirección", patient.address, MapPin], ["Ciudad / provincia", patient.city, MapPin]]} /></PatientSectionCard>
        <PatientSectionCard title="Estado y observaciones" icon={Stethoscope} action={editSection("preferences", "observaciones y preferencias")}><Information items={[
          ["Seguimiento", <PatientStatus key="status" status={patient.treatmentStatus} />, Stethoscope],
          ["Notificaciones", patient.notificationsEnabled ? "Habilitadas" : "Deshabilitadas", Bell],
          ["Última visita", lastVisit.isLoading ? "Cargando…" : lastVisit.isError ? "No disponible" : lastVisit.date ? formatDateOnly(lastVisit.date) : "Sin atenciones completadas", CalendarDays],
          ["Observaciones del registro", patient.notes || "Sin observaciones registradas.", MessageSquare],
        ]} /></PatientSectionCard>
        <PatientSectionCard title="Datos personales" icon={UserRound} action={editSection("personal", "datos personales")}><Information items={[["Fecha de nacimiento", formatDateOnly(patient.birthDate, { day: "2-digit", month: "long", year: "numeric" }), CalendarDays], ["Género", genderLabels[patient.gender], UserRound], ["Estado civil", maritalStatusLabels[patient.maritalStatus], Heart], ["Ocupación", patient.occupation, BriefcaseBusiness], ["Empresa / institución", patient.company, Building2], ["Nacionalidad", patient.nationality, Globe]]} /></PatientSectionCard>
        <PatientSectionCard title="Emergencia y seguro" icon={ShieldCheck} action={editSection("emergency", "emergencia y seguro")}><Information items={[["Contacto de emergencia", `${patient.emergencyContactName || "No registrado"}${patient.emergencyContactRelationship ? ` (${patient.emergencyContactRelationship})` : ""}`, UserRound], ["Teléfono del contacto", patient.emergencyContactPhone, Phone], ["Seguro / convenio", patient.insuranceProvider, ShieldCheck], ["Número de póliza", patient.insurancePolicy, FileText]]} /></PatientSectionCard>
        <PatientSectionCard title="Documentos y consentimientos" icon={FileText} className="patient-consent-card"><div className="patient-consent-summary"><Information items={[["Consentimiento informado", <PatientStateBadge key="consent" status={patient.consentSigned ? "otorgado" : "pendiente"}>{patient.consentSigned ? "Firmado" : "No firmado"}</PatientStateBadge>, ShieldCheck]]} /><p className="patient-field-help">El consentimiento de datos personales y los archivos clínicos se consultan en sus registros correspondientes.</p><Button variant="outline" onClick={() => setSection("documentos")}><FolderOpen />Consultar archivos</Button></div></PatientSectionCard>
      </div></SectionNavigationPanel>
      <SectionNavigationPanel value="citas"><PatientAppointments patientId={patient.id} /></SectionNavigationPanel>
      {clinical && <SectionNavigationPanel value="historial"><div className="patient-clinical-tab"><PatientClinicalSummary patientId={patient.id} /></div></SectionNavigationPanel>}
      <SectionNavigationPanel value="tratamientos"><PatientTreatments patientId={patient.id} canReadClinical={clinical} /></SectionNavigationPanel>
      {(role === "admin" || role === "recepcion") && <SectionNavigationPanel value="finanzas"><PatientFinances patientId={patient.id} canOpenPortfolio /></SectionNavigationPanel>}
      <SectionNavigationPanel value="documentos">{clinical ? <PatientDocuments patientId={patient.id} /> : <PatientEmptyState icon={ShieldCheck} title="Los documentos clínicos requieren un perfil clínico autorizado." description={`Consentimiento informado registrado: ${patient.consentSigned ? "Firmado" : "No firmado"}.`} />}</SectionNavigationPanel>
    </PatientTabs>
    {scheduling && <AppointmentFormDialog open onOpenChange={setScheduling} initialPatientId={patient.id} />}
    {editing && <PatientFormDialog mode="edit" patient={patient} initialSection={editing.section} returnFocus={editing.trigger} onClose={() => setEditing(null)} />}
  </div></PatientActionsProvider>
}
