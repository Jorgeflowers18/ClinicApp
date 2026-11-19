import { useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Eye, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { SearchInput } from "@/shared/components/search-input"
import { ResponsiveFilterBar } from "@/shared/components/responsive-filter-bar"
import { FilterField } from "@/shared/components/filter-field"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { getErrorMessage } from "@/shared/lib/error-message"
import { formatCurrency } from "@/shared/lib/number"
import { queryClient } from "@/shared/lib/query-client"

import { treatmentsKeys, useDeleteTreatment } from "../api/treatments.queries"
import { useTreatmentCatalog } from "../hooks/use-treatment-options"
import { TreatmentFormDialog } from "../components/treatment-form-dialog"
import { TreatmentStatus } from "../components/treatment-status"
import type { Treatment } from "../types/treatment.types"
import "../treatments.css"

const ALL = "__clinic_all__"

function matchesFilters(item: Treatment, search: string, category: string, status: string) {
  return (!search || (item.name + " " + item.category).toLowerCase().includes(search)) &&
    (category === ALL || item.category === category) &&
    (status === ALL || item.active === (status === "active"))
}

export function TreatmentsListPage() {
  const navigate = useNavigate()
  const { search, setSearch, debouncedSearch, page, setPage, pageSize } = useTableQueryState()
  const catalog = useTreatmentCatalog()
  const [category, setCategory] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [editor, setEditor] = useState<string | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const createButton = useRef<HTMLButtonElement>(null)
  const categories = [...new Set((catalog.data ?? []).map(item => item.category))].sort((a, b) => a.localeCompare(b))
  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    return (catalog.data ?? []).filter(item => matchesFilters(item, query, category, status))
  }, [catalog.data, debouncedSearch, category, status])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const filterCount = Number(category !== ALL) + Number(status !== ALL) + Number(Boolean(search.trim()))
  function editorReturnFocus() {
    const saved = editor && editor !== "new" ? queryClient.getQueryData<Treatment>(treatmentsKeys.detail(editor)) : undefined
    if (saved && !matchesFilters(saved, debouncedSearch.trim().toLowerCase(), category, status)) return createButton.current
    return returnFocus.current?.isConnected ? returnFocus.current : createButton.current
  }
  function clearFilters() { setSearch(""); setCategory(ALL); setStatus(ALL); setPage(1) }
  function filters() {
    return <>
      <FilterField label="Categoría"><Select items={{ [ALL]: "Todas las categorías", ...Object.fromEntries(categories.map(value => [value, value])), ...(category !== ALL ? { [category]: category } : {}) }} value={category}
        onValueChange={value => { setCategory(value ?? ALL); setPage(1) }} disabled={!catalog.data}>
        <SelectTrigger aria-label="Filtrar por categoría" className="treatment-category-filter"><SelectValue /></SelectTrigger>
        <SelectContent>{[ALL, ...categories].map(value => <SelectItem key={value} value={value}>{value === ALL ? "Todas las categorías" : value}</SelectItem>)}</SelectContent>
      </Select></FilterField>
      <FilterField label="Estado"><Select items={{ [ALL]: "Todos los estados", active: "Activo", inactive: "Inactivo" }} value={status}
        onValueChange={value => { setStatus(value ?? ALL); setPage(1) }}>
        <SelectTrigger aria-label="Filtrar por estado" className="treatment-status-filter"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={ALL}>Todos los estados</SelectItem><SelectItem value="active">Activo</SelectItem><SelectItem value="inactive">Inactivo</SelectItem></SelectContent>
      </Select></FilterField>
    </>
  }
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
    { key: "price", header: "Precio", cell: (row) => formatCurrency(row.price) },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <TreatmentStatus active={row.active} />,
    },
    {
      key: "actions",
      header: "Acciones",
      className: "w-10 text-right",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8"
            aria-label={`Acciones del tratamiento ${row.name}`}
            onClick={(event) => { event.stopPropagation(); returnFocus.current = event.currentTarget }}
            onKeyDown={event => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="treatment-action-menu" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
            <DropdownMenuItem onClick={() => navigate(`/tratamientos/${row.id}`)}>
              <Eye aria-hidden="true" />Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditor(row.id)}>
              <Pencil aria-hidden="true" />Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setTreatmentToDelete(row)}>
              <Trash2 aria-hidden="true" />Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  function handleDelete() {
    if(!treatmentToDelete) return
    deleteTreatment.mutate(treatmentToDelete.id, {
      onSuccess: () => {
        toast.success("Tratamiento eliminado")
        setTreatmentToDelete(null)
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  return (
    <div className="treatments-catalog space-y-4">
      <PageHeader
        title="Tratamientos"
        description="Catálogo de tratamientos y servicios ofrecidos por la clínica."
        actions={
          <Button ref={createButton} onClick={event => { returnFocus.current = event.currentTarget; setEditor("new") }}>
            <Plus />
            Nuevo tratamiento
          </Button>
        }
      />

      <ResponsiveFilterBar search={<SearchInput value={search} onChange={setSearch} ariaLabel="Buscar tratamientos" placeholder="Buscar por nombre o categoría..." />}
        desktopFilters={filters()} panelTitle="Filtros de tratamientos" activeFilterCount={filterCount} onClear={clearFilters}>
        <div className="treatment-mobile-filters">{filters()}</div>
      </ResponsiveFilterBar>

      <DataTable
        className={!catalog.isPending && !catalog.isError && visible.length === 0 ? "treatment-empty-table" : undefined}
        columns={columns}
        data={visible}
        mobileTitleKey="name"
        getRowId={(row) => row.id}
        isLoading={catalog.isPending}
        isError={catalog.isError}
        errorMessage={getErrorMessage(catalog.error)}
        onRowClick={(row) => navigate(`/tratamientos/${row.id}`)}
        getRowLabel={(row) => `Ver tratamiento: ${row.name}`}
        emptyTitle="Sin tratamientos"
        emptyDescription={filterCount ? "No hay tratamientos que coincidan con la búsqueda y los filtros." : "Aún no hay tratamientos registrados."}
      />

      {catalog.data && (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      {editor && <TreatmentFormDialog key={editor} treatmentId={editor === "new" ? undefined : editor} returnFocus={editorReturnFocus} onClose={() => setEditor(null)} />}

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
