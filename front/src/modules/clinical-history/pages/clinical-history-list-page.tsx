import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { FolderOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { ResponsiveFilterBar } from "@/shared/components/responsive-filter-bar"
import { FilterField } from "@/shared/components/filter-field"
import { SearchInput } from "@/shared/components/search-input"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { PatientCombobox } from "@/modules/patients/components/patient-combobox"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { useEncountersList } from "../api/clinical-history.queries"
import { resolveProfessionalName } from "../lib/record"
import { diagnosisSummary, type EncounterListItem } from "../types/clinical-history.types"
import "../components/clinical-density.css"
import styles from "./clinical-history-list.module.css"

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
  const { data: professionals } = useProfessionals()

  const professionalItems: Record<string, string> = {
    [ALL]: "Todos los profesionales",
    ...Object.fromEntries((professionals ?? []).map((item) => [item.id, item.name])),
  }

  function changePatient(value: string) {
    setPage(1)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set("pacienteId", value)
      else next.delete("pacienteId")
      return next
    })
  }

  function changeProfessional(value: string | null) {
    setPage(1)
    setProfessionalId(value && value !== ALL ? value : undefined)
  }

  const activeFilterCount = Number(Boolean(patientId)) + Number(Boolean(professionalId))

  function clearFilters() {
    setPage(1)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete("pacienteId")
      return next
    })
    setProfessionalId(undefined)
  }

  function openEncounter(row: EncounterListItem) {
    navigate(`/historial-clinico/paciente/${row.patientId}?atencion=${row.id}`)
  }

  const columns: DataTableColumn<EncounterListItem>[] = [
    { key: "date", header: "Fecha", cell: (row) => shortDate(row.date) },
    { key: "patient", header: "Paciente", cell: (row) => row.patientName || "Paciente" },
    { key: "reason", header: "Motivo de consulta", cell: (row) => row.reason || "—", className: "max-w-56 truncate" },
    { key: "diagnosis", header: "Diagnóstico", cell: (row) => diagnosisSummary(row) || "—", className: "max-w-56 truncate" },
    { key: "professional", header: "Profesional", cell: (row) => resolveProfessionalName(row, professionals) },
    {
      key: "nextVisit",
      header: "Próximo control",
      cell: (row) => (row.nextVisit ? shortDate(row.nextVisit) : <span className="text-muted-foreground">—</span>),
      className: styles.nextControl,
    },
  ]

  const desktopFilters = (
    <>
      <FilterField label="Paciente"><PatientCombobox className="w-56" value={patientId ?? ""} onChange={changePatient} clearable
        ariaLabel="Filtrar por paciente" placeholder="Todos los pacientes" /></FilterField>
      <FilterField label="Profesional"><Select items={professionalItems} value={professionalId ?? ALL} onValueChange={changeProfessional}>
        <SelectTrigger className="w-56" aria-label="Filtrar por profesional">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(professionalItems).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select></FilterField>
    </>
  )

  return (
    <div className="clinic-history-list space-y-4">
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

      <ResponsiveFilterBar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            ariaLabel="Buscar atenciones clínicas"
            placeholder="Buscar por paciente, motivo o diagnóstico..."
          />
        }
        desktopFilters={desktopFilters}
        panelTitle="Filtros del historial"
        activeFilterCount={activeFilterCount}
        onClear={clearFilters}
      >
        <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Paciente</p>
              <PatientCombobox value={patientId ?? ""} onChange={changePatient} clearable
                ariaLabel="Filtrar por paciente" placeholder="Todos los pacientes" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Profesional</p>
              <Select
                items={professionalItems}
                value={professionalId ?? ALL}
                onValueChange={changeProfessional}
              >
                <SelectTrigger className="w-full" aria-label="Filtrar por profesional">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(professionalItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
      </ResponsiveFilterBar>

      <DataTable
        columns={columns}
        mobileTitleKey="patient"
        data={data?.items ?? []}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={getErrorMessage(error)}
        onRowClick={openEncounter}
        getRowLabel={(row) => `Abrir atención de ${row.patientName || "paciente"}`}
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
