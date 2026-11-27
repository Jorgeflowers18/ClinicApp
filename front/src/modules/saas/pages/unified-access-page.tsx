import { useState } from "react"
import { MoreHorizontal, Plus, UserRound, Pencil, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { PageHeader } from "@/shared/components/page-header"
import { DataTable } from "@/shared/components/data-table"
import { SearchInput } from "@/shared/components/search-input"
import { AccountStatusBadge, ProfessionalStatusBadge, SaasSelect } from "../components/controls"
import { useUsers } from "@/modules/auth/api/users.queries"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { UserFormDialog } from "@/modules/auth/components/user-form-dialog"
import { PasswordLinkDialog } from "@/modules/auth/components/password-link-dialog"
import { ProfessionalFormDialog } from "@/modules/appointments/components/professional-form-dialog"
import type { ManagedUser, PasswordLink } from "@/modules/auth/types/user-admin.types"
import type { Professional } from "@/modules/appointments/types/appointment.types"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useDemoContext, useSaasData } from "../state"
import { useStaffInstitution } from "../lib/institution-scope"
import { assignedRoles, accessRoles } from "../lib/access-catalogs"
import { StaffManagementPage } from "./staff-page"
import "../saas.css"

import { unifiedServerPeople, type ServerPerson as Person } from "../lib/server-people"
export function UnifiedAccessPage() {
  const demo = useDemoContext(state => state.userId)
  return demo ? <StaffManagementPage /> : <ServerAccessPage />
}
function ServerAccessPage() {
  const users = useUsers(), professionals = useProfessionals(), data = useSaasData(), { organizationId } = useStaffInstitution()
  const [search, setSearch] = useState(""), [type, setType] = useState("all"), [role, setRole] = useState("all")
  const [editor, setEditor] = useState<{ user: ManagedUser | null; professional?: Professional } | null>(null)
  const [professional, setProfessional] = useState<Professional | null | undefined>(), [details, setDetails] = useState<Person | null>(null)
  const [link, setLink] = useState<{ name: string; link: PasswordLink } | null>(null)
  const settings = data.serverStaffSettings?.[organizationId] ?? {}, types = data.professionalTypes?.filter(item => item.organizationId === organizationId) ?? []
  const preferences = (person: Person) => settings[person.id] ?? settings["professional:" + person.professional?.id]
  const username = (person: Person) => settings[person.id]?.username || data.identities.find(item => item.id === person.user?.id)?.username || "Sin nombre de usuario"
  const assigned = (person: Person) => assignedRoles({ roles: person.user ? [person.user.role] : [], accessRoleIds: settings[person.id]?.accessRoleIds }, data, organizationId)
  const typeName = (person: Person) => types.find(type => type.id === preferences(person)?.professionalTypeId)?.name || (person.professional ? "Por asignar" : "No aplica")
  const rows = unifiedServerPeople(users.data ?? [], professionals.data ?? []).filter(person => (!search || [person.name, person.user?.email, username(person), typeName(person), ...assigned(person).map(role => role.name)].join(" ").toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es"))) && (type === "all" || preferences(person)?.professionalTypeId === type) && (role === "all" || assigned(person).some(item => item.id === role)))
  return <div className="saas-scope saas-stack staff-management">
    <PageHeader title="Usuarios y profesionales" description="Gestiona las cuentas y el personal de tu clínica" actions={<div className="saas-inline"><Button variant="outline" onClick={() => setProfessional(null)}>Registrar profesional</Button><Button onClick={() => setEditor({ user: null })}><Plus />Nuevo usuario</Button></div>} />
    <div className="saas-filters"><SearchInput value={search} onChange={setSearch} ariaLabel="Buscar personal" placeholder="Nombre, usuario, correo, tipo o rol…" />
      <SaasSelect label="Tipo de profesional" value={type} onChange={setType} items={{ all: "Todos", ...Object.fromEntries(types.map(item => [item.id, item.name])) }} />
      <SaasSelect label="Rol" value={role} onChange={setRole} items={{ all: "Todos", ...Object.fromEntries(accessRoles(data, organizationId).map(item => [item.id, item.name])) }} />
    </div>
    <DataTable className="unified-staff-table" data={rows} getRowId={row => row.id} mobileTitleKey="person" isLoading={users.isPending || professionals.isPending} isError={users.isError || professionals.isError} errorMessage={getErrorMessage(users.error ?? professionals.error)} columns={[
      { key: "person", header: "Persona", cell: person => <div className="saas-person"><span className="saas-avatar">{person.name.split(" ").map(part => part[0]).slice(0,2).join("")}</span><div><strong>{person.name}</strong><p className="saas-hint">{person.user?.email ?? "Sin correo registrado"}</p></div></div> },
      { key: "username", header: "Usuario", cell: person => person.user ? username(person) : <div className="saas-stack saas-compact"><span>Sin cuenta</span><Button variant="outline" size="sm" onClick={() => setEditor({ user: null, professional: person.professional! })}>Crear acceso</Button></div> },
      { key: "type", header: "Tipo de profesional", cell: typeName },
      { key: "roles", header: "Rol", cell: person => <div className="saas-inline" title={assigned(person).map(item => item.name).join(" · ")}>{assigned(person).slice(0,2).map(item => <Badge key={item.id} variant="secondary">{item.name}</Badge>)}{assigned(person).length > 2 && <Badge variant="outline">+{assigned(person).length - 2}</Badge>}</div> },
      { key: "state", header: "Estado", cell: person => <div className="saas-inline">{person.user && <span title="Estado de cuenta"><AccountStatusBadge state={person.user.active ? "active" : "inactive"} /></span>}{person.professional && <span title="Estado profesional"><ProfessionalStatusBadge state={person.professional.active ? "ACTIVE" : "INACTIVE"} /></span>}</div> },
      { key: "actions", header: "Acciones", cell: person => <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={"Acciones de " + person.name} />}><MoreHorizontal /></DropdownMenuTrigger><DropdownMenuContent align="end" className="saas-user-menu">
        <DropdownMenuItem onClick={() => setDetails(person)}><UserRound />Ver perfil</DropdownMenuItem>
        <DropdownMenuItem onClick={() => person.user ? setEditor({ user: person.user }) : setProfessional(person.professional)}><Pencil />Editar</DropdownMenuItem>
        {person.user ? <DropdownMenuItem onClick={() => setEditor({ user: person.user })}><ShieldCheck />Gestionar acceso</DropdownMenuItem> : <DropdownMenuItem onClick={() => setEditor({ user: null, professional: person.professional! })}><ShieldCheck />Crear acceso</DropdownMenuItem>}
        {person.professional && person.user && <DropdownMenuItem onClick={() => setProfessional(person.professional)}><Pencil />Editar perfil profesional</DropdownMenuItem>}
      </DropdownMenuContent></DropdownMenu> },
    ]} />
    {editor && <UserFormDialog open user={editor.user} prefillProfessional={editor.professional} onOpenChange={open => !open && setEditor(null)} onPasswordLink={setLink} />}
    {professional !== undefined && <ProfessionalFormDialog open professional={professional} onOpenChange={open => !open && setProfessional(undefined)} />}
    <PasswordLinkDialog value={link} onClose={() => setLink(null)} />
    {details && <Dialog open onOpenChange={open => !open && setDetails(null)}><DialogContent className="saas-scope"><DialogHeader><DialogTitle>{details.name}</DialogTitle><DialogDescription>Perfil administrativo</DialogDescription></DialogHeader><DialogBody><dl className="saas-summary">
      {[["Usuario", details.user ? username(details) : "Sin cuenta"], ["Correo", details.user?.email], ["Tipo de profesional", typeName(details)], ["Roles", assigned(details).map(role => role.name).join(" · ")], ["Especialidad", details.professional?.specialty]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}
      {details.user && <div><dt>Estado de cuenta</dt><dd><AccountStatusBadge state={details.user.active ? "active" : "inactive"} /></dd></div>}{details.professional && <div><dt>Estado profesional</dt><dd><ProfessionalStatusBadge state={details.professional.active ? "ACTIVE" : "INACTIVE"} /></dd></div>}
    </dl></DialogBody><DialogFooter><Button variant="outline" onClick={() => setDetails(null)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>}
  </div>
}
