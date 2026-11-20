import { ClinicalFileManager } from "@/modules/clinical-history/archive/components/clinical-file-manager"
import { useNavigate } from "react-router-dom"
import { CalendarDays, CalendarClock, CheckCheck, ChevronDown, CircleAlert, Clock3, FileText, ReceiptText, Stethoscope, UserRound, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/shared/components/data-table"
import { formatDateOnly, formatDateTime, formatTime } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useAppointmentsByPatient, useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { appointmentStatusLabels } from "@/modules/appointments/types/appointment.types"
import { useTreatment, usePatientAssignments } from "@/modules/treatments/api/treatments.queries"
import { assignmentStatusLabels } from "@/modules/treatments/types/treatment.types"
import { usePatientFinancialSummary, useTreatmentFinancialSummary } from "@/modules/finance/api/finance.queries"
import { useClinicalHistory } from "@/modules/clinical-history/api/clinical-history.queries"
import { dataConsentStatusLabels } from "@/modules/clinical-history/types/clinical-history.types"
import { resolveProfessionalName } from "@/modules/clinical-history/lib/record"
import { PatientEmptyState, PatientStateBadge } from "./patient-ui"

function TreatmentName({ id }: { id?: string }) {
  const query = useTreatment(id)
  return <>{!id ? "No registrado" : query.isLoading ? "Cargando…" : query.data?.name ?? "No disponible"}</>
}

function TreatmentProfessional({ patientId, encounterId }: { patientId: string; encounterId: string }) {
  const query = useClinicalHistory(patientId)
  const { data: professionals } = useProfessionals()
  const encounter = query.data?.encounters.find(item => item.id === encounterId)
  return <>{query.isLoading ? "Cargando…" : encounter ? resolveProfessionalName(encounter, professionals) : "No disponible"}</>
}

export function PatientAppointments({ patientId }: { patientId: string }) {
  const navigate = useNavigate()
  const query = useAppointmentsByPatient(patientId)
  const professionals = useProfessionals()
  return <div className="patient-related-tab"><div className="patient-tab-heading"><h2><CalendarDays aria-hidden="true" />Citas del paciente</h2><Button variant="outline" onClick={() => navigate(`/citas?pacienteId=${patientId}`)}><CalendarDays />Ver citas en el calendario</Button></div>
    <DataTable className="patient-related-table" data={query.data ?? []} getRowId={row => row.id} isLoading={query.isLoading} isError={query.isError} errorMessage={getErrorMessage(query.error)} emptyTitle="Sin citas registradas" emptyDescription="Utiliza Agendar cita para programar la primera."
      columns={[
        { key: "date", header: "Fecha y hora", cell: row => <div className="patient-date-cell"><span><CalendarDays aria-hidden="true" />{formatDateTime(row.start, { day: "2-digit", month: "short", year: "numeric" })}</span><small><Clock3 aria-hidden="true" />{formatTime(row.start)} – {formatTime(row.end)}</small></div> },
        { key: "professional", header: "Profesional", cell: row => <span className="patient-contact"><UserRound aria-hidden="true" />{professionals.isLoading ? "Cargando…" : professionals.isError ? "No disponible" : professionals.data?.find(item => item.id === row.professionalId)?.name ?? "No registrado"}</span> },
        { key: "treatment", header: "Tratamiento", cell: row => <TreatmentName id={row.treatmentId} /> },
        { key: "status", header: "Estado", cell: row => <PatientStateBadge status={row.status}>{appointmentStatusLabels[row.status]}</PatientStateBadge> },
      ]} />
  </div>
}

export function PatientTreatments({ patientId, canReadClinical }: { patientId: string; canReadClinical: boolean }) {
  const navigate = useNavigate()
  const query = usePatientAssignments(patientId)
  return <div className="patient-related-tab"><div className="patient-tab-heading"><h2><Stethoscope aria-hidden="true" />Tratamientos asociados</h2><Button variant="outline" onClick={() => navigate(`/tratamientos?pacienteId=${patientId}`)}>Ver tratamientos</Button></div>
    {!query.isLoading && !query.isError && !query.data?.length ? <PatientEmptyState icon={Stethoscope} title="Sin tratamientos asociados" description="Aquí aparecerán los tratamientos registrados para este paciente." /> : <DataTable className="patient-related-table" data={query.data ?? []} getRowId={row => row.id} isLoading={query.isLoading} isError={query.isError} errorMessage={getErrorMessage(query.error)}
      columns={[
        { key: "treatment", header: "Tratamiento", cell: row => <button className="patient-text-link" onClick={() => navigate(`/tratamientos/${row.treatmentId}`)}><TreatmentName id={row.treatmentId} /></button> },
        { key: "date", header: "Fecha de inicio", cell: row => formatDateOnly(row.startDate) },
        ...(canReadClinical ? [{ key: "professional", header: "Profesional", cell: (row: NonNullable<typeof query.data>[number]) => row.sourceEncounterId ? <TreatmentProfessional patientId={patientId} encounterId={row.sourceEncounterId} /> : "No registrado" }] : []),
        { key: "status", header: "Estado", cell: row => <PatientStateBadge status={row.status}>{assignmentStatusLabels[row.status]}</PatientStateBadge> },
        { key: "sessions", header: "Sesiones", cell: row => <span className="patient-sessions">{row.completedSessions} / {row.totalSessions}</span> },
      ]} />}
  </div>
}

const financialStatusLabels: Record<string, string> = { registrado: "Registrado", anulado: "Anulado", reversado: "Reversado", pendiente: "Pendiente", parcial: "Parcial", pagada: "Pagada", vencida: "Vencida", cancelada: "Cancelada", borrador: "Borrador", emitida: "Emitida", autorizada: "Autorizada", anulada: "Anulada" }

function PatientTreatmentLedger({ patientId, treatmentId }: { patientId: string; treatmentId: string }) {
  const query = useTreatmentFinancialSummary(treatmentId, patientId)
  if (query.isLoading) return <Skeleton className="h-14 w-full" />
  if (query.isError || !query.data) return <div role="alert" className="patient-source-error">No se pudieron cargar los movimientos.<Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div>
  const data = query.data
  return <details className="patient-ledger"><summary><ReceiptText aria-hidden="true" /><span>{data.treatmentName}</span><small>{data.payments.length} {data.payments.length === 1 ? "pago" : "pagos"}</small><ChevronDown aria-hidden="true" /></summary><div className="patient-ledger-content">
    <h3>Pagos registrados</h3><DataTable className="patient-related-table patient-money-table" data={data.payments} getRowId={row => row.id} emptyTitle="Sin pagos registrados" emptyDescription="Los pagos aparecerán cuando se registren en Finanzas." columns={[
      { key: "date", header: "Fecha", cell: row => formatDateOnly(row.date) },
      { key: "concept", header: "Concepto", cell: () => data.treatmentName },
      { key: "reference", header: "Comprobante", cell: row => row.reference || "No registrado" },
      { key: "amount", header: "Valor", className: "text-right", cell: row => formatCurrency(row.amount) },
      { key: "status", header: "Estado", cell: row => <PatientStateBadge status={row.status}>{financialStatusLabels[row.status]}</PatientStateBadge> },
    ]} />
    {data.installments.length > 0 && <><h3>Cuotas y vencimientos</h3><DataTable className="patient-related-table patient-money-table" data={data.installments} getRowId={row => row.id} columns={[
      { key: "number", header: "Cuota", cell: row => row.number },
      { key: "due", header: "Vencimiento", cell: row => formatDateOnly(row.dueDate) },
      { key: "amount", header: "Valor", className: "text-right", cell: row => formatCurrency(row.amount) },
      { key: "balance", header: "Pendiente", className: "text-right", cell: row => formatCurrency(row.balance) },
      { key: "status", header: "Estado", cell: row => <PatientStateBadge status={row.status}>{financialStatusLabels[row.status]}</PatientStateBadge> },
    ]} /></>}
    {data.invoice && <div className="patient-invoice"><FileText aria-hidden="true" /><div><h3>Factura {data.invoice.number}</h3><p>{formatDateOnly(data.invoice.issueDate)}</p></div><strong>{formatCurrency(data.invoice.total)}</strong><PatientStateBadge status={data.invoice.status}>{financialStatusLabels[data.invoice.status]}</PatientStateBadge></div>}
  </div></details>
}

function PatientFinancialMovements({ patientId }: { patientId: string }) {
  const query = usePatientAssignments(patientId)
  if (query.isLoading) return <Skeleton className="h-14 w-full" />
  if (query.isError) return <div role="alert" className="patient-source-error">No se pudieron consultar los tratamientos para mostrar sus movimientos.<Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div>
  const treatmentIds = [...new Set(query.data?.map(item => item.treatmentId))]
  return <section className="patient-movements" aria-label="Movimientos financieros del paciente"><h2>Tratamientos y movimientos</h2>{treatmentIds.length ? treatmentIds.map(treatmentId => <PatientTreatmentLedger key={treatmentId} patientId={patientId} treatmentId={treatmentId} />) : <PatientEmptyState icon={Wallet} title="Sin movimientos asociados" description="No hay tratamientos asociados para consultar movimientos financieros." />}</section>
}

export function PatientFinances({ patientId, canOpenPortfolio }: { patientId: string; canOpenPortfolio: boolean }) {
  const navigate = useNavigate()
  const query = usePatientFinancialSummary(patientId)
  if (query.isLoading) return <Skeleton className="h-28 w-full" />
  if (query.isError || !query.data) return <div role="alert" className="patient-source-error">No se pudo cargar el resumen financiero.<Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div>
  const data = query.data
  return <div className="patient-related-tab"><div className="patient-tab-heading"><h2><Wallet aria-hidden="true" />Información financiera</h2>{canOpenPortfolio && <Button variant="outline" onClick={() => navigate("/finanzas")}>Ver cartera financiera</Button>}</div><dl className="patient-financial-summary">
    {[
      { label: "Total tratamientos", value: String(data.totalTreatments), icon: Stethoscope, tone: "neutral" },
      { label: "Total pagado", value: formatCurrency(data.totalPaid), icon: CheckCheck, tone: "success" },
      { label: "Total pendiente", value: formatCurrency(data.totalPending), icon: Clock3, tone: "warning" },
      { label: "Total vencido", value: formatCurrency(data.totalOverdue), icon: CircleAlert, tone: data.totalOverdue > 0 ? "danger" : "neutral" },
    ].map(({ label, value, icon: Icon, tone }) => <div key={label} data-tone={tone}><Icon aria-hidden="true" /><div><dt>{label}</dt><dd>{value}</dd></div></div>)}
  </dl><p className="patient-next-due"><CalendarClock aria-hidden="true" />Próximo vencimiento: <strong>{data.nextDueDate ? formatDateOnly(data.nextDueDate) : "Sin vencimientos pendientes"}</strong></p>{canOpenPortfolio && <PatientFinancialMovements patientId={patientId} />}</div>
}

export function PatientDocuments({ patientId }: { patientId: string }) {
  const query = useClinicalHistory(patientId)
  return <div className="patient-related-tab"><p className="patient-field-help">Consentimiento de datos personales: {query.data ? <PatientStateBadge status={query.data.record.dataConsent.status}>{dataConsentStatusLabels[query.data.record.dataConsent.status]}</PatientStateBadge> : "Consultando"}. Se conserva por separado del consentimiento informado del paciente.</p><ClinicalFileManager patientId={patientId} /></div>
}
