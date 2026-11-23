import { useState } from "react"
import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { SearchInput } from "@/shared/components/search-input"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useUsers } from "@/modules/auth/api/users.queries"

import { useProfessionals, useRooms } from "../api/appointments.queries"
import type { Professional, Room } from "../types/appointment.types"
import { ProfessionalFormDialog } from "./professional-form-dialog"
import { RoomFormDialog } from "./room-form-dialog"

// Catálogos pequeños (decenas de filas): llegan completos y se filtran aquí.
const matches = (search: string, ...values: string[]) => {
  const needle = search.trim().toLocaleLowerCase("es")
  return !needle || values.join(" ").toLocaleLowerCase("es").includes(needle)
}

const statusBadge = (active: boolean) =>
  <Badge variant={active ? "secondary" : "outline"}>{active ? "Activo" : "Inactivo"}</Badge>

function useEditor<T>() {
  const [state, setState] = useState<{ open: boolean; item: T | null }>({ open: false, item: null })
  return {
    ...state,
    create: () => setState({ open: true, item: null }),
    edit: (item: T) => setState({ open: true, item }),
    setOpen: (open: boolean) => setState((current) => ({ ...current, open })),
  }
}

/** Profesionales: nombre, especialidad, registro y activo. Solo admin. */
export function ProfessionalsAdmin() {
  const query = useProfessionals()
  const users = useUsers()
  const userName = (id: string) => users.data?.find((user) => user.id === id)?.name ?? "Vinculada"
  const editor = useEditor<Professional>()
  const [search, setSearch] = useState("")
  const rows = (query.data ?? []).filter((item) => matches(search, item.name, item.specialty, item.registrationNumber))
  const columns: DataTableColumn<Professional>[] = [
    { key: "name", header: "Profesional", cell: (item) => <div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.specialty}</p></div> },
    { key: "registrationNumber", header: "Registro", cell: (item) => item.registrationNumber || "—" },
    // La cuenta se vincula desde la pestaña Usuarios.
    { key: "userId", header: "Cuenta", cell: (item) => item.userId ? userName(item.userId) : "Sin cuenta" },
    { key: "active", header: "Estado", cell: (item) => statusBadge(item.active) },
  ]
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SearchInput value={search} onChange={setSearch} ariaLabel="Buscar profesionales" placeholder="Buscar por nombre, especialidad o registro…" />
      <Button onClick={editor.create}><Plus aria-hidden="true" />Nuevo profesional</Button>
    </div>
    <DataTable columns={columns} data={rows} getRowId={(item) => item.id} mobileTitleKey="name"
      isLoading={query.isPending} isError={query.isError} errorMessage={getErrorMessage(query.error)}
      onRowClick={editor.edit} getRowLabel={(item) => `Editar profesional: ${item.name}`}
      emptyTitle={search ? "Sin coincidencias" : "Sin profesionales"}
      emptyDescription={search ? "No hay profesionales que coincidan con la búsqueda." : "Registra a los profesionales para agendar sus citas."} />
    <ProfessionalFormDialog open={editor.open} onOpenChange={editor.setOpen} professional={editor.item} />
  </div>
}

/** Consultorios: nombre y activo. Solo admin. */
export function RoomsAdmin() {
  const query = useRooms()
  const editor = useEditor<Room>()
  const [search, setSearch] = useState("")
  const rows = (query.data ?? []).filter((item) => matches(search, item.name))
  const columns: DataTableColumn<Room>[] = [
    { key: "name", header: "Consultorio", cell: (item) => <span className="font-medium">{item.name}</span> },
    { key: "active", header: "Estado", cell: (item) => statusBadge(item.active) },
  ]
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SearchInput value={search} onChange={setSearch} ariaLabel="Buscar consultorios" placeholder="Buscar por nombre…" />
      <Button onClick={editor.create}><Plus aria-hidden="true" />Nuevo consultorio</Button>
    </div>
    <DataTable columns={columns} data={rows} getRowId={(item) => item.id} mobileTitleKey="name"
      isLoading={query.isPending} isError={query.isError} errorMessage={getErrorMessage(query.error)}
      onRowClick={editor.edit} getRowLabel={(item) => `Editar consultorio: ${item.name}`}
      emptyTitle={search ? "Sin coincidencias" : "Sin consultorios"}
      emptyDescription={search ? "No hay consultorios que coincidan con la búsqueda." : "Registra los consultorios para asignarlos a las citas."} />
    <RoomFormDialog open={editor.open} onOpenChange={editor.setOpen} room={editor.item} />
  </div>
}
