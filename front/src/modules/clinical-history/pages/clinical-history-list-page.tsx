import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { FolderOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { SearchInput } from "@/shared/components/search-input"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatientsList } from "@/modules/patients/api/patients.queries"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { useEncountersList } from "../api/clinical-history.queries"
import { resolveProfessionalName } from "../lib/record"
import type { EncounterListItem } from "../types/clinical-history.types"

const ALL = "todos"
const shortDate = (value: string) => formatDateOnly(value, { day: "2-digit", month: "short", year: "numeric" })

export function ClinicalHistoryListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const patientId = searchParams.get("pacienteId") ?? undefined
  const [professionalId, setProfessionalId] = useState<string | undefined>()

  const { search, setSearch, debouncedSearch, page, setPage, pageSize } = useTableQueryState()
  const { data, isLoading, isError, error } = useEncountersList({
    page,
    pageSize,
    search: debouncedSearch,
    patientId,
    professionalId,
  })
  const { data: patientsPage } = usePatientsList({ page: 1, pageSize: 100 })
  const { data: professionals } = useProfessionals()

  const patientItems: Record<string, string> = {
    [ALL]: "Todos los pacientes",
    ...Object.fromEntries((patientsPage?.items ?? []).map((item) => [item.id, `${item.firstName} ${item.lastName}`])),
  }
  const professionalItems: Record<string, string> = {
    [ALL]: "Todos los profesionales",
    ...Object.fromEntries((professionals ?? []).map((item) => [item.id, item.name])),
  }

  function changePatient(value: string | null) {
    setPage(1)
    setSearchParams(value && value !== ALL ? { pacienteId: value } : {})
  }

  function openEncounter(row: EncounterListItem) {
    navigate(`/historial-clinico/paciente/${row.patientId}?atencion=${row.id}`)
  }

  const columns: DataTableColumn<EncounterListItem>[] = [
    { key: "date", header: "Fecha", cell: (row) => shortDate(row.date) },
    { key: "patient", header: "Paciente", cell: (row) => patientItems[row.patientId] ?? "Paciente" },
    { key: "reason", header: "Motivo de consulta", cell: (row) => row.reason || "—", className: "max-w-56 truncate" },
    { key: "diagnosis", header: "Diagnóstico", cell: (row) => row.diagnosis || "—", className: "max-w-56 truncate" },
    { key: "professional", header: "Profesional", cell: (row) => resolveProfessionalName(row, professionals) },
    { key: "nextVisit", header: "Próximo control", cell: (row) => (row.nextVisit ? shortDate(row.nextVisit) : "—") },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Historial clínico"
        description="Atenciones odontológicas de todos los pacientes. Acceso restringido a personal médico y administración."
        actions={
          patientId && (
            <Button onClick={() => navigate(`/historial-clinico/paciente/${patientId}`)}>
              <FolderOpen />
              Abrir historia clínica
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por paciente, motivo o diagnóstico..." />
        <Select items={patientItems} value={patientId ?? ALL} onValueChange={changePatient}>
          <SelectTrigger className="w-56" aria-label="Filtrar por paciente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(patientItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={professionalItems}
          value={professionalId ?? ALL}
          onValueChange={(value) => {
            setPage(1)
            setProfessionalId(value && value !== ALL ? value : undefined)
          }}
        >
          <SelectTrigger className="w-56" aria-label="Filtrar por profesional">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(professionalItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={getErrorMessage(error)}
        onRowClick={openEncounter}
        emptyTitle="Sin atenciones"
        emptyDescription={
          patientId
            ? "Este paciente aún no tiene atenciones. Abre su historia clínica para registrar la primera."
            : "No hay atenciones con estos criterios."
        }
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
