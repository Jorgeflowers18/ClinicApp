import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { MoreHorizontal, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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

import { useDeleteTreatment, useTreatmentsList } from "../api/treatments.queries"
import type { Treatment } from "../types/treatment.types"

export function TreatmentsListPage() {
  const navigate = useNavigate()
  const { search, setSearch, debouncedSearch, page, setPage, pageSize } = useTableQueryState()
  const { data, isLoading, isError, error } = useTreatmentsList({
    page,
    pageSize,
    search: debouncedSearch,
  })
  const deleteTreatment = useDeleteTreatment()
  const [treatmentToDelete, setTreatmentToDelete] = useState<Treatment | null>(null)

  const columns: DataTableColumn<Treatment>[] = [
    {
      key: "name",
      header: "Tratamiento",
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.category}</p>
        </div>
      ),
    },
    { key: "duration", header: "Duración", cell: (row) => `${row.durationMinutes} min` },
    { key: "price", header: "Precio", cell: (row) => `$${row.price.toFixed(2)}` },
    {
      key: "status",
      header: "Estado",
      cell: (row) => (
        <Badge variant={row.active ? "default" : "outline"}>{row.active ? "Activo" : "Inactivo"}</Badge>
      ),
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
            <DropdownMenuItem onClick={() => navigate(`/tratamientos/${row.id}`)}>
              Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/tratamientos/${row.id}/editar`)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setTreatmentToDelete(row)}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  function handleDelete() {
    if (!treatmentToDelete) return
    deleteTreatment.mutate(treatmentToDelete.id, {
      onSuccess: () => {
        toast.success("Tratamiento eliminado")
        setTreatmentToDelete(null)
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tratamientos"
        description="Catálogo de tratamientos y servicios ofrecidos por la clínica."
        actions={
          <Button onClick={() => navigate("/tratamientos/nuevo")}>
            <Plus />
            Nuevo tratamiento
          </Button>
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o categoría..." />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={getErrorMessage(error)}
        onRowClick={(row) => navigate(`/tratamientos/${row.id}`)}
        emptyTitle="Sin tratamientos"
        emptyDescription="Aún no hay tratamientos registrados con estos criterios."
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
        open={!!treatmentToDelete}
        onOpenChange={(open) => !open && setTreatmentToDelete(null)}
        title="Eliminar tratamiento"
        description={`¿Confirmas que deseas eliminar "${treatmentToDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        isLoading={deleteTreatment.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
