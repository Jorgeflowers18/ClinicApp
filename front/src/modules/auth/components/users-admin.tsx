import { useState } from "react"
import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { SearchInput } from "@/shared/components/search-input"
import { formatDateTime } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"

import { useUsers } from "../api/users.queries"
import { roleLabels, type ManagedUser, type PasswordLink } from "../types/user-admin.types"
import { PasswordLinkDialog } from "./password-link-dialog"
import { UserFormDialog } from "./user-form-dialog"

/** Cuentas de usuario (solo admin): crear, rol, profesional vinculado, desactivar y enlace de contraseña. */
export function UsersAdmin() {
  const query = useUsers()
  const [editor, setEditor] = useState<{ open: boolean; user: ManagedUser | null }>({ open: false, user: null })
  const [link, setLink] = useState<{ name: string; link: PasswordLink } | null>(null)
  const [search, setSearch] = useState("")
  const needle = search.trim().toLocaleLowerCase("es")
  const rows = (query.data ?? []).filter((user) => !needle
    || [user.name, user.email, roleLabels[user.role], user.professionalName ?? ""].join(" ").toLocaleLowerCase("es").includes(needle))
  const columns: DataTableColumn<ManagedUser>[] = [
    { key: "name", header: "Usuario", cell: (user) => <div><p className="font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div> },
    { key: "role", header: "Rol", cell: (user) => roleLabels[user.role] ?? user.role },
    { key: "professionalName", header: "Profesional", cell: (user) => user.professionalName ?? "—" },
    { key: "lastLoginAt", header: "Último ingreso", cell: (user) => user.lastLoginAt ? formatDateTime(user.lastLoginAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Nunca" },
    { key: "active", header: "Estado", cell: (user) => <Badge variant={user.active ? "secondary" : "outline"}>{user.active ? "Activa" : "Inactiva"}</Badge> },
  ]
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SearchInput value={search} onChange={setSearch} ariaLabel="Buscar usuarios" placeholder="Buscar por nombre, correo, rol o profesional…" />
      <Button onClick={() => setEditor({ open: true, user: null })}><Plus aria-hidden="true" />Nueva cuenta</Button>
    </div>
    <DataTable columns={columns} data={rows} getRowId={(user) => user.id} mobileTitleKey="name"
      isLoading={query.isPending} isError={query.isError} errorMessage={getErrorMessage(query.error)}
      onRowClick={(user) => setEditor({ open: true, user })} getRowLabel={(user) => `Editar cuenta: ${user.name}`}
      emptyTitle={search ? "Sin coincidencias" : "Sin cuentas"}
      emptyDescription={search ? "No hay cuentas que coincidan con la búsqueda." : "Crea las cuentas del personal de la clínica."} />
    <UserFormDialog open={editor.open} onOpenChange={(open) => setEditor((current) => ({ ...current, open }))} user={editor.user} onPasswordLink={setLink} />
    <PasswordLinkDialog value={link} onClose={() => setLink(null)} />
  </div>
}
