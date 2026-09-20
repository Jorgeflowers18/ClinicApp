import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { MoreHorizontal, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { SearchInput } from "@/shared/components/search-input"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { getErrorMessage } from "@/shared/lib/error-message"
import { formatDateTime } from "@/shared/lib/date"

import { useDeletePatient, usePatientsList } from "../api/patients.queries"
import { treatmentStatusLabels, type Patient } from "../types/patient.types"

export function PatientsListPage() {
  const navigate = useNavigate()
  const { search, setSearch, debouncedSearch, page, setPage, pageSize } = useTableQueryState()
  const { data, isLoading, isError, error } = usePatientsList({
    page,
    pageSize,
    search: debouncedSearch,
  })
  const deletePatient = useDeletePatient()
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null)

  const columns: DataTableColumn<Patient>[] = [
    {
      key: "name",
      header: "Paciente",
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">
            {row.firstName} {row.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{row.documentId}</p>
        </div>
      ),
    },
    { key: "phone", header: "Teléfono", cell: (row) => row.phone },
    { key: "email", header: "Correo", cell: (row) => row.email || "—" },
    {
      key: "treatmentStatus",
      header: "Estado",
      cell: (row) => (
        <span className="inline-flex rounded-full border border-border px-2 py-1 text-xs font-medium">
          {treatmentStatusLabels[row.treatmentStatus ?? "activo"]}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Registrado",
      cell: (row) =>
        formatDateTime(row.createdAt, { year: "numeric", month: "short", day: "2-digit" }),
    },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/pacientes/${row.id}`)}>
              Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/pacientes/${row.id}/editar`)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setPatientToDelete(row)}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  function handleDelete() {
    if (!patientToDelete) return
    deletePatient.mutate(patientToDelete.id, {
      onSuccess: () => {
        toast.success("Paciente eliminado")
        setPatientToDelete(null)
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pacientes"
        description="Gestiona el registro de pacientes de la clínica."
        actions={
          <Button onClick={() => navigate("/pacientes/nuevo")}>
            <Plus />
            Nuevo paciente
          </Button>
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, cédula o teléfono..." />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={getErrorMessage(error)}
        onRowClick={(row) => navigate(`/pacientes/${row.id}`)}
        emptyTitle="Sin pacientes"
        emptyDescription="Aún no hay pacientes registrados con estos criterios."
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

      <ConfirmDialog
        open={!!patientToDelete}
        onOpenChange={(open) => !open && setPatientToDelete(null)}
        title="Eliminar paciente"
        description={`¿Confirmas que deseas eliminar a ${patientToDelete?.firstName} ${patientToDelete?.lastName}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        isLoading={deletePatient.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
