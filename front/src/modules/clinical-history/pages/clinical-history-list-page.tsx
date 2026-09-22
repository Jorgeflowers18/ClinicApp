import { useNavigate, useSearchParams } from "react-router-dom"
import { useState } from "react"
import { Plus, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { SearchInput } from "@/shared/components/search-input"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatientsList } from "@/modules/patients/api/patients.queries"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { useClinicalHistoryList } from "../api/clinical-history.queries"
import type { ClinicalHistoryEntry } from "../types/clinical-history.types"

export function ClinicalHistoryListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const patientId = searchParams.get("pacienteId") ?? undefined
  const [dentalPatientId, setDentalPatientId] = useState("")

  const { search, setSearch, debouncedSearch, page, setPage, pageSize } = useTableQueryState()
  const { data, isLoading, isError, error } = useClinicalHistoryList({
    page,
    pageSize,
    search: debouncedSearch,
    patientId,
  })
  const { data: patientsPage } = usePatientsList({ page: 1, pageSize: 100 })
  const { data: professionals } = useProfessionals()

  const filteredPatient = patientId ? patientsPage?.items.find((p) => p.id === patientId) : undefined

  function patientName(id: string) {
    const patient = patientsPage?.items.find((item) => item.id === id)
    return patient ? `${patient.firstName} ${patient.lastName}` : id
  }

  function professionalName(id: string) {
    return professionals?.find((item) => item.id === id)?.name ?? id
  }

  const columns: DataTableColumn<ClinicalHistoryEntry>[] = [
    { key: "date", header: "Fecha", cell: (row) => formatDateOnly(row.date, { day: "2-digit", month: "short", year: "numeric" }) },
    { key: "patient", header: "Paciente", cell: (row) => patientName(row.patientId) },
    { key: "reason", header: "Motivo de consulta", cell: (row) => row.reason },
    { key: "diagnosis", header: "Diagnóstico", cell: (row) => row.diagnosis },
    { key: "professional", header: "Profesional", cell: (row) => professionalName(row.professionalId) },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Historial clínico"
        description="Registro cronológico de consultas y diagnósticos. Acceso restringido a personal médico y administración."
        actions={
          <Button
            onClick={() => navigate(patientId ? `/historial-clinico/nuevo?pacienteId=${patientId}` : "/historial-clinico/nuevo")}
          >
            <Plus />
            Nuevo registro
          </Button>
        }
      />

      <section className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="font-medium">Historia y tratamiento odontológico</h2>
          <p className="text-sm text-muted-foreground">Odontograma, periodontograma, evolución, planes de tratamiento y documentos por visita.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="dental-patient" className="text-sm font-medium">Paciente de la historia odontológica</label>
          <select id="dental-patient" className="block h-9 w-full rounded-md border bg-background px-3 text-sm" value={dentalPatientId || patientId || ""} onChange={(event) => setDentalPatientId(event.target.value)}>
            <option value="">Selecciona un paciente</option>
            {patientsPage?.items.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>)}
          </select>
        </div>
        <Button disabled={!(dentalPatientId || patientId)} onClick={() => navigate(`/historial-clinico/paciente/${dentalPatientId || patientId}/odontologia`)}>Abrir historia odontológica</Button>
      </section>

      {filteredPatient && (
        <div className="flex w-fit items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm">
          Filtrando por paciente:
          <Badge variant="secondary">
            {filteredPatient.firstName} {filteredPatient.lastName}
          </Badge>
          <button
            onClick={() => setSearchParams({})}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Quitar filtro de paciente"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <SearchInput value={search} onChange={setSearch} placeholder="Buscar por motivo o diagnóstico..." />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={getErrorMessage(error)}
        onRowClick={(row) => navigate(`/historial-clinico/${row.id}`)}
        emptyTitle="Sin registros"
        emptyDescription="No hay registros de historial clínico con estos criterios."
      />

      {data && (
        <PaginationBar
          page={data.page}
          pageSize={data.pageSize}
          totalItems={data.totalItems}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
