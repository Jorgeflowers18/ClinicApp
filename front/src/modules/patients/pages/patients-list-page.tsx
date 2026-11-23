import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { CalendarDays, Mail, Phone, Plus, SlidersHorizontal, UsersRound, UserRoundCheck, UserRoundX, UserRoundSearch } from "lucide-react"
import { ResetFiltersButton } from "@/shared/components/reset-filters-button"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { SearchInput } from "@/shared/components/search-input"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { getErrorMessage } from "@/shared/lib/error-message"
import { formatDateTime } from "@/shared/lib/date"
import { AppointmentFormDialog } from "@/modules/appointments/components/appointment-form-dialog"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { usePatientsList, useRestorePatient } from "../api/patients.queries"
import { genderOptions, treatmentStatusOptions, type Patient, type PatientsQuery } from "../types/patient.types"
import { PatientInitials, PatientStatus } from "../components/patient-status"
import { PatientActions, PatientActionsProvider } from "../components/patient-actions"
import { PatientFormDialog } from "../components/patient-form-dialog"

type PatientEditor = { returnFocus: HTMLElement | null } & ({ mode: "create"; patient?: never } | { mode: "edit"; patient: Patient })

export function PatientsListPage() {
  const navigate = useNavigate()
  const { search, setSearch, debouncedSearch, page, setPage, pageSize } = useTableQueryState()
  const [filters, setFilters] = useState<Omit<PatientsQuery, "page" | "pageSize" | "search">>({})
  const [advanced, setAdvanced] = useState(false)
  const [schedulePatient, setSchedulePatient] = useState<Patient | null>(null)
  const [editor, setEditor] = useState<PatientEditor | null>(null)
  const isAdmin = useAuthStore(state => state.user?.role === "admin")
  const restore = useRestorePatient()
  const query = usePatientsList({ page, pageSize, search: debouncedSearch, ...filters })
  const total = usePatientsList({ page: 1, pageSize: 1 })
  const active = usePatientsList({ page: 1, pageSize: 1, status: "activo" })
  const followUp = usePatientsList({ page: 1, pageSize: 1, status: "en seguimiento" })
  const inactive = usePatientsList({ page: 1, pageSize: 1, status: "inactivo" })
  const hasFilters = !!search || Object.values(filters).some(Boolean)
  const advancedCount = [filters.gender, filters.registeredFrom, filters.registeredTo, filters.deleted].filter(Boolean).length
  async function reactivate(patient: Patient) {
    try {
      await restore.mutateAsync(patient.id)
      toast.success(`${patient.firstName} ${patient.lastName} fue reactivado`)
    } catch (error) { toast.error(getErrorMessage(error)) }
  }
  const invalidRange = !!filters.registeredFrom && !!filters.registeredTo && filters.registeredFrom > filters.registeredTo
  function changeFilters(update: Partial<typeof filters>) { setFilters(current => ({ ...current, ...update })); setPage(1) }
  function clear() { setSearch(""); setFilters({}); setPage(1) }
  const columns: DataTableColumn<Patient>[] = [
    { key: "name", header: "Paciente", cell: patient => <div className="patient-identity"><PatientInitials patient={patient} /><div><p className="font-medium">{patient.firstName} {patient.lastName}</p><p className="text-xs text-muted-foreground">{patient.documentId}</p></div></div> },
    { key: "phone", header: "Teléfono", cell: patient => <span className="patient-contact"><Phone aria-hidden="true" />{patient.phone || "—"}</span> },
    { key: "email", header: "Correo", cell: patient => <span className="patient-contact"><Mail aria-hidden="true" />{patient.email || "—"}</span> },
    { key: "treatmentStatus", header: "Estado", cell: patient => <PatientStatus status={patient.treatmentStatus} /> },
    { key: "createdAt", header: "Registrado", cell: patient => <span className="patient-contact"><CalendarDays aria-hidden="true" />{formatDateTime(patient.createdAt, { year: "numeric", month: "short", day: "2-digit" })}</span> },
    { key: "actions", header: "Acciones", className: "w-12 text-right", cell: patient => patient.deletedAt
      // Dado de baja: solo se reactiva (no se edita ni se agenda).
      ? <Button variant="outline" size="sm" disabled={restore.isPending} onClick={event => { event.stopPropagation(); void reactivate(patient) }} aria-label={`Reactivar a ${patient.firstName} ${patient.lastName}`}>Reactivar</Button>
      : <PatientActions patient={patient} onSchedule={() => setSchedulePatient(patient)} onEdit={trigger => setEditor({ mode: "edit", patient, returnFocus: trigger })} /> },
  ]
  return <PatientActionsProvider><div className="clinic-pilot clinic-pilot-page clinic-patients-page space-y-4">
    <PageHeader className="clinic-pilot-header" title="Pacientes" description="Gestiona la información y el seguimiento de tus pacientes."
      actions={<Button className="patient-new-button" onClick={event => setEditor({ mode: "create", returnFocus: event.currentTarget })}><Plus />Nuevo paciente</Button>} />
    <div className="patient-statistics" role="group" aria-label="Resumen de pacientes">
      {[
        { label: "Pacientes registrados", source: total, icon: UsersRound, tone: "primary" },
        { label: "Activos", source: active, icon: UserRoundCheck, tone: "success" },
        { label: "En seguimiento", source: followUp, icon: UserRoundSearch, tone: "warning" },
        { label: "Inactivos", source: inactive, icon: UserRoundX, tone: "neutral" },
      ].map(({ label, source, icon: Icon, tone }) => <div key={label} className="patient-statistic" data-tone={tone}><span><Icon aria-hidden="true" /></span><div><strong>{source.isLoading || source.isError ? "—" : source.data?.totalItems ?? "—"}</strong><p>{label}</p></div></div>)}
    </div>
    <div className="patient-toolbar">
      <SearchInput value={search} onChange={setSearch} ariaLabel="Buscar pacientes" placeholder="Buscar por nombre, documento, teléfono o N.° de historia…" className="clinic-patients-search" />
      <div className="patient-status-filter"><label htmlFor="patient-status-filter">Estado</label>
        <Select items={{ all: "Todos", ...Object.fromEntries(treatmentStatusOptions.map(option => [option.value, option.label])) }} value={filters.status ?? "all"} onValueChange={value => changeFilters({ status: value === "all" ? undefined : value as Patient["treatmentStatus"] })}>
          <SelectTrigger id="patient-status-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{treatmentStatusOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button variant="outline" aria-expanded={advanced} aria-controls="patient-advanced-filters" onClick={() => setAdvanced(value => !value)}><SlidersHorizontal />Filtros avanzados{advancedCount > 0 && <span>({advancedCount})</span>}</Button>
      <ResetFiltersButton onReset={clear} disabled={!hasFilters} />
    </div>
    <div id="patient-advanced-filters" className="patient-advanced-filters" hidden={!advanced} role="region" aria-label="Filtros avanzados de pacientes">
      <div><label htmlFor="patient-gender-filter">Género</label><Select items={{ all: "Todos", ...Object.fromEntries(genderOptions.map(option => [option.value, option.label])) }} value={filters.gender ?? "all"} onValueChange={value => changeFilters({ gender: value === "all" ? undefined : value as Patient["gender"] })}>
        <SelectTrigger id="patient-gender-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{genderOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select></div>
      <div><label htmlFor="patient-registered-from">Registrado desde</label><Input id="patient-registered-from" type="date" value={filters.registeredFrom ?? ""} max={filters.registeredTo} onChange={event => changeFilters({ registeredFrom: event.target.value || undefined })} /></div>
      <div><label htmlFor="patient-registered-to">Registrado hasta</label><Input id="patient-registered-to" type="date" value={filters.registeredTo ?? ""} min={filters.registeredFrom} onChange={event => changeFilters({ registeredTo: event.target.value || undefined })} /></div>
      {isAdmin && <div className="patient-deleted-filter"><Checkbox id="patient-deleted-filter" checked={!!filters.deleted} onCheckedChange={checked => changeFilters({ deleted: checked === true || undefined })} /><label htmlFor="patient-deleted-filter">Ver solo pacientes dados de baja</label></div>}
      {invalidRange && <p role="alert">La fecha final debe ser igual o posterior a la inicial.</p>}
    </div>
    <p className="patient-list-order">{filters.deleted ? "Dados de baja · más recientes primero" : "Más recientes primero"}</p>
    <div aria-busy={query.isFetching}>
      <DataTable columns={columns} data={invalidRange ? [] : query.data?.items ?? []} getRowId={row => row.id} isLoading={query.isLoading} isError={query.isError} errorMessage={getErrorMessage(query.error)}
        onRowClick={row => navigate(`/pacientes/${row.id}`)} getRowLabel={row => `Abrir detalles del paciente ${row.firstName} ${row.lastName}`}
        emptyTitle={filters.deleted ? "Sin pacientes dados de baja" : hasFilters ? "Sin coincidencias" : "Sin pacientes"} emptyDescription={hasFilters ? "Prueba con otros criterios o limpia los filtros." : "Registra tu primer paciente para comenzar."} className="clinic-patients-table" />
    </div>
    {query.data && !invalidRange && <PaginationBar page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} totalPages={query.data.totalPages} onPageChange={setPage} />}
    {schedulePatient && <AppointmentFormDialog open onOpenChange={open => !open && setSchedulePatient(null)} initialPatientId={schedulePatient.id} />}
    {editor && <PatientFormDialog {...editor} onClose={() => setEditor(null)} />}
  </div></PatientActionsProvider>
}
