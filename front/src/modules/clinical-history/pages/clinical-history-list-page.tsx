import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { FolderOpen } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { ResponsiveFilterBar } from "@/shared/components/responsive-filter-bar"
import { SearchInput } from "@/shared/components/search-input"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatientsList } from "@/modules/patients/api/patients.queries"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { useDentalVisitsList } from "../api/clinical-history.queries"
import { resolveProfessionalName } from "../lib/visit"
import { visitStatuses, visitStatusLabels, type VisitListItem, type VisitStatus } from "../types/clinical-history.types"

const ALL = "todos"
const shortDate = (value: string) => formatDateOnly(value, { day: "2-digit", month: "short", year: "numeric" })

export function ClinicalHistoryListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const patientId = searchParams.get("pacienteId") ?? undefined
  const [status, setStatus] = useState<VisitStatus | undefined>()
  const [professionalId, setProfessionalId] = useState<string | undefined>()
  const { search, setSearch, debouncedSearch, page, setPage, pageSize } = useTableQueryState()
  const { data, isLoading, isError, error } = useDentalVisitsList({
    page,
    pageSize,
    search: debouncedSearch,
    patientId,
    professionalId,
    status,
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
  const statusItems: Record<string, string> = {
    [ALL]: "Todos los estados",
    ...Object.fromEntries(visitStatuses.map((item) => [item, visitStatusLabels[item]])),
  }

  function changePatient(value: string | null) {
    setPage(1)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value && value !== ALL) next.set("pacienteId", value)
      else next.delete("pacienteId")
      return next
    })
  }

  function changeProfessional(value: string | null) {
    setPage(1)
    setProfessionalId(value && value !== ALL ? value : undefined)
  }

  function changeStatus(value: string | null) {
    setPage(1)
    setStatus(value && value !== ALL ? (value as VisitStatus) : undefined)
  }

  const activeFilterCount = Number(Boolean(patientId)) + Number(Boolean(professionalId)) + Number(Boolean(status))

  function clearFilters() {
    setPage(1)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete("pacienteId")
      return next
    })
    setProfessionalId(undefined)
    setStatus(undefined)
  }

  function openVisit(row: VisitListItem) {
    navigate(`/historial-clinico/paciente/${row.patientId}?visita=${row.id}`)
  }

  const columns: DataTableColumn<VisitListItem>[] = [
    { key: "date", header: "Fecha", cell: (row) => shortDate(row.date) },
    { key: "patient", header: "Paciente", cell: (row) => patientItems[row.patientId] ?? "Paciente" },
    { key: "reason", header: "Motivo de consulta", cell: (row) => row.reason || "—", className: "max-w-56 truncate" },
    { key: "diagnosis", header: "Diagnóstico", cell: (row) => row.diagnosis || "—", className: "max-w-56 truncate" },
    { key: "professional", header: "Profesional", cell: (row) => resolveProfessionalName(row, professionals) },
    {
      key: "status",
      header: "Estado",
      cell: (row) => (
        <Badge variant={row.status === "borrador" ? "secondary" : "outline"}>{visitStatusLabels[row.status]}</Badge>
      ),
    },
    { key: "nextVisit", header: "Próximo control", cell: (row) => (row.nextVisit ? shortDate(row.nextVisit) : "—") },
  ]

  const desktopFilters = (
    <>
      <Select items={patientItems} value={patientId ?? ALL} onValueChange={changePatient}>
        <SelectTrigger className="w-56" aria-label="Filtrar por paciente">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(patientItems).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select items={professionalItems} value={professionalId ?? ALL} onValueChange={changeProfessional}>
        <SelectTrigger className="w-56" aria-label="Filtrar por profesional">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(professionalItems).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select items={statusItems} value={status ?? ALL} onValueChange={changeStatus}>
        <SelectTrigger className="w-44" aria-label="Filtrar por estado">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(statusItems).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Historial clínico"
        description="Visitas odontológicas de todos los pacientes. Acceso restringido a personal médico y administración."
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
            ariaLabel="Buscar visitas clínicas"
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
              <Select items={patientItems} value={patientId ?? ALL} onValueChange={changePatient}>
                <SelectTrigger className="w-full" aria-label="Filtrar por paciente">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(patientItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <p className="text-sm font-medium">Estado</p>
              <Select
                items={statusItems}
                value={status ?? ALL}
                onValueChange={changeStatus}
              >
                <SelectTrigger className="w-full" aria-label="Filtrar por estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusItems).map(([value, label]) => (
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
        onRowClick={openVisit}
        getRowLabel={(row) => `Abrir visita de ${patientItems[row.patientId] ?? "paciente"}`}
        emptyTitle="Sin visitas"
        emptyDescription={
          patientId
            ? "Este paciente aún no tiene visitas. Abre su historia clínica para iniciar la primera."
            : "No hay visitas con estos criterios."
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
