import { useState } from "react"
import { Pencil, Plus, Power } from "lucide-react"

import { AdministrativeStatusBadge, ProfessionalStatusBadge } from "@/shared/components/administrative-status-badge"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { SearchInput } from "@/shared/components/search-input"
import { ResetFiltersButton } from "@/shared/components/reset-filters-button"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import styles from "@/modules/saas/components/administrative-ui.module.css"
import { SaasSelect } from "@/modules/saas/components/controls"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useUsers } from "@/modules/auth/api/users.queries"

import { useProfessionals, useRooms, useSaveRoom } from "../api/appointments.queries"
import type { Professional, Room } from "../types/appointment.types"
import { ProfessionalFormDialog } from "./professional-form-dialog"
import { RoomFormDialog } from "./room-form-dialog"

// Catálogos pequeños (decenas de filas): llegan completos y se filtran aquí.
const matches = (search: string, ...values: string[]) => {
  const needle = search.trim().toLocaleLowerCase("es")
  return !needle || values.join(" ").toLocaleLowerCase("es").includes(needle)
}

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
    { key: "active", header: "Estado", cell: (item) => <ProfessionalStatusBadge state={item.active ? "ACTIVE" : "INACTIVE"} /> },
  ]
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
  const save = useSaveRoom()
  const editor = useEditor<Room>()
  const [search, setSearch] = useState("")
  const [state, setState] = useState("all")
  const [deactivating, setDeactivating] = useState<Room | null>(null), [failure, setFailure] = useState("")
  async function toggle(room: Room) {
    if (save.isPending) return
    setFailure("")
    try { await save.mutateAsync({ id: room.id, values: { name: room.name, active: !room.active } }); setDeactivating(null) }
    catch (error) { setFailure(getErrorMessage(error)) }
  }
  const rows = (query.data ?? []).filter((item) => matches(search, item.name) && (state === "all" || item.active === (state === "active")))
  const columns: DataTableColumn<Room>[] = [
    { key: "name", header: "Consultorio", cell: (item) => <span className="font-medium">{item.name}</span> },
    { key: "active", header: "Estado", cell: (item) => <AdministrativeStatusBadge kind="room" state={item.active ? "active" : "inactive"} /> },
    { key: "actions", header: "", cell: item => <div className="staff-specialty-actions">
      <Button variant="outline" size="sm" onClick={event => { event.stopPropagation(); editor.edit(item) }}><Pencil/>Editar</Button>
      <Button variant="outline" size="sm" disabled={save.isPending} onClick={event => { event.stopPropagation(); setFailure(""); if (item.active) setDeactivating(item); else void toggle(item) }}><Power/>{item.active ? "Desactivar" : "Activar"}</Button>
    </div> },
  ]
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <SearchInput value={search} onChange={setSearch} ariaLabel="Buscar consultorios" placeholder="Buscar por nombre…" />
      <SaasSelect label="Estado" statusKind="room" value={state} onChange={setState} items={{ all: "Todos", active: "Activo", inactive: "Inactivo" }} />
      <ResetFiltersButton disabled={!search && state === "all"} onReset={() => { setSearch(""); setState("all") }} />
      <Button onClick={editor.create}><Plus aria-hidden="true" />Nuevo consultorio</Button>
    </div>
    {failure && !deactivating && <p role="alert" className="text-destructive">{failure}</p>}
    <DataTable className={styles.table} columns={columns} data={rows} getRowId={(item) => item.id} mobileTitleKey="name"
      isLoading={query.isPending} isError={query.isError} errorMessage={getErrorMessage(query.error)}
      onRowClick={editor.edit} getRowLabel={(item) => `Editar consultorio: ${item.name}`}
      emptyTitle={search ? "Sin coincidencias" : "Sin consultorios"}
      emptyDescription={search ? "No hay consultorios que coincidan con la búsqueda." : "Registra los consultorios para asignarlos a las citas."} />
    <RoomFormDialog open={editor.open} onOpenChange={editor.setOpen} room={editor.item} />
    {deactivating && <ConfirmDialog open onOpenChange={open => !open && !save.isPending && setDeactivating(null)} title="Desactivar consultorio" description={`«${deactivating.name}» no se ofrecerá para nuevas citas. Se conservarán sus registros históricos.${failure ? " " + failure : ""}`} confirmLabel="Desactivar" isLoading={save.isPending} onConfirm={() => void toggle(deactivating)}/>}
  </div>
}
