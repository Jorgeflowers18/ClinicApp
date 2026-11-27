import { useState } from "react"
import { CalendarDays, LayoutGrid, List, Mail, MoreHorizontal, Pencil, Plus, ShieldCheck, Stethoscope, UserRound, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { PageHeader } from "@/shared/components/page-header"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { SearchInput } from "@/shared/components/search-input"
import { ResetFiltersButton } from "@/shared/components/reset-filters-button"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useSaasData, useSessionUser } from "../state"
import { useStaffInstitution } from "../lib/institution-scope"
import { accessRoles, assignedRoles, roleSummary } from "../lib/access-catalogs"
import { nameOf } from "../lib/identity"
import { effectiveProfessionalState } from "../lib/professional-policy"
import { demoStaffAdapter } from "../services"
import { updateDemoData } from "../adapters/demo-repository"
import { staffFromRequest } from "../lib/staff-draft"
import { accountStates, professionalStates, type StaffUser } from "../types"
import { AccountStatusBadge, ProfessionalStatusBadge, SaasSelect } from "../components/controls"
import { StaffEditor } from "../components/staff-editor"
import { ProfessionalStatusDialog } from "../components/professional-status-dialog"
import { AccessManagementDialog } from "../components/access-management-dialog"
import "../saas.css"

export function StaffManagementPage() {
  const data = useSaasData(), { organizationId, organization, profile, error } = useStaffInstitution(), actor = useSessionUser()
  const [search, setSearch] = useState(""), [role, setRole] = useState("all"), [state, setState] = useState("all"), [type, setType] = useState("all"), [site, setSite] = useState("all")
  const [specialty, setSpecialty] = useState("all"), [professionalState, setProfessionalState] = useState("all"), [cards, setCards] = useState(false)
  const [editor, setEditor] = useState<{ user: StaffUser | null; account: boolean } | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null), [statusId, setStatusId] = useState<string | null>(null)
  const [accessId, setAccessId] = useState<string | null>(null), [toggleId, setToggleId] = useState<string | null>(null)
  const [failure, setFailure] = useState(""), [busy, setBusy] = useState(false)
  const all = data.users.filter(user => user.organizationIds.includes(organizationId)), catalog = accessRoles(data, organizationId)
  const requests = data.requests.filter(request => request.organizationId === organizationId)
  const types = data.professionalTypes?.filter(item => item.organizationId === organizationId) ?? []
  const specialtyNames = (user: StaffUser) => data.specialties.filter(item => item.organizationId === organizationId && user.specialtyIds.includes(item.id)).map(item => item.name).join(" · ") || "—"
  const typeName = (user: StaffUser) => types.find(item => item.id === user.professionalTypeId)?.name || (user.professionalId ? user.profession || "Por asignar" : "No aplica")
  const siteNames = (user: StaffUser) => (profile?.branches ?? []).filter(branch => user.assignments.some(item => item.active && item.organizationId === organizationId && item.siteId === branch.id)).map(branch => branch.name).join(" · ") || "Pendiente de asignar sede"
  const needle = search.trim().toLocaleLowerCase("es")
  const rows = all.filter(user => (!needle || [nameOf(user), user.username, user.email, typeName(user), roleSummary(user, data, organizationId), specialtyNames(user)].join(" ").toLocaleLowerCase("es").includes(needle))
    && (role === "all" || assignedRoles(user, data, organizationId).some(item => item.id === role))
    && (type === "all" || user.professionalTypeId === type)
    && (state === "all" || (state === "without-account" ? user.hasAccount === false : user.hasAccount !== false && user.state === state))
    && (professionalState === "all" || Boolean(user.professionalId) && effectiveProfessionalState(user) === professionalState)
    && (specialty === "all" || user.specialtyIds.includes(specialty))
    && (site === "all" || user.assignments.some(item => item.organizationId === organizationId && item.active && item.siteId === site)))
  const details = all.find(user => user.id === detailsId), statusUser = all.find(user => user.id === statusId), accessUser = all.find(user => user.id === accessId), toggleUser = all.find(user => user.id === toggleId)
  function actions(user: StaffUser) {
    return <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={"Acciones de " + nameOf(user)} />}><MoreHorizontal /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="saas-user-menu">
        <DropdownMenuItem onClick={() => setDetailsId(user.id)}><UserRound />Ver perfil</DropdownMenuItem>
        <DropdownMenuItem disabled={!profile} onClick={() => setEditor({ user, account: user.hasAccount !== false })}><Pencil />Editar</DropdownMenuItem>
        {user.hasAccount === false ? <DropdownMenuItem onClick={() => setEditor({ user, account: true })}><ShieldCheck />Crear acceso</DropdownMenuItem>
          : <DropdownMenuItem onClick={() => setAccessId(user.id)}><ShieldCheck />Gestionar acceso</DropdownMenuItem>}
        {user.professionalId && <DropdownMenuItem onClick={() => setStatusId(user.id)}><Stethoscope />Estado profesional</DropdownMenuItem>}
        {user.hasAccount !== false && <><DropdownMenuSeparator /><DropdownMenuItem disabled={user.id === actor?.id} variant={user.state === "inactive" ? "default" : "destructive"} onClick={() => { setFailure(""); setToggleId(user.id) }}>
          {user.state === "inactive" ? <UserRoundCheck /> : <UserRoundX />}{user.state === "inactive" ? "Reactivar" : "Desactivar"}
        </DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
  }
  const columns: DataTableColumn<StaffUser>[] = [
    { key: "person", header: "Persona", cell: user => <div className="saas-person"><span className="saas-avatar">{user.firstName[0]}{user.lastName[0]}</span><div><strong>{nameOf(user)}</strong><p className="saas-hint">{user.email || "Sin correo registrado"}</p></div></div> },
    { key: "username", header: "Usuario", cell: user => user.hasAccount === false ? <div className="saas-stack saas-compact"><span className="saas-hint">Sin cuenta</span><Button variant="outline" size="sm" onClick={() => setEditor({ user, account: true })}>Crear acceso</Button></div> : user.username },
    { key: "type", header: "Tipo de profesional", cell: typeName },
    { key: "roles", header: "Rol", cell: user => user.hasAccount === false ? "—" : <div className="saas-inline" title={roleSummary(user, data, organizationId)}>{assignedRoles(user, data, organizationId).slice(0,2).map(role => <Badge variant="secondary" key={role.id}>{role.name}</Badge>)}{assignedRoles(user, data, organizationId).length > 2 && <Badge variant="outline">+{assignedRoles(user, data, organizationId).length - 2}</Badge>}</div> },
    { key: "state", header: "Estado", cell: user => <div className="saas-inline">{user.hasAccount !== false && <span title="Estado de cuenta"><AccountStatusBadge state={user.state} /></span>}{user.professionalId && <span title="Estado profesional"><ProfessionalStatusBadge state={effectiveProfessionalState(user)} /></span>}</div> },
    { key: "actions", header: "Acciones", cell: actions },
  ]
  async function toggleAccount() {
    if (!toggleUser || busy) return
    setBusy(true); setFailure("")
    try { await demoStaffAdapter.saveUser({ ...toggleUser, state: toggleUser.state === "inactive" ? toggleUser.activation === "invitation" ? "pending" : "active" : "inactive" }); setToggleId(null) }
    catch (error) { setFailure(getErrorMessage(error)) }
    finally { setBusy(false) }
  }
  return <div className="saas-scope saas-stack staff-management">
    <PageHeader title="Usuarios y profesionales" description="Gestiona las cuentas y el personal de tu clínica" actions={<div className="saas-inline">
      <Button variant="outline" disabled={!profile} onClick={() => setEditor({ user: null, account: false })}>Registrar profesional</Button>
      <Button disabled={!profile} onClick={() => setEditor({ user: null, account: true })}><Plus />Nuevo usuario</Button>
    </div>} />
    {Boolean(error) && <p role="alert" className="text-destructive">{getErrorMessage(error)}</p>}
    <div className="saas-metrics">{[
      { label: "Usuarios activos", value: all.filter(user => user.hasAccount !== false && user.state === "active").length, Icon: UsersRound, tone: "success" },
      { label: "Profesionales activos", value: all.filter(user => user.professionalId && effectiveProfessionalState(user) === "ACTIVE").length, Icon: Stethoscope, tone: "success" },
      { label: "Profesionales de vacaciones", value: all.filter(user => user.professionalId && effectiveProfessionalState(user) === "VACATION").length, Icon: CalendarDays, tone: "info" },
      { label: "Invitaciones pendientes", value: all.filter(user => user.hasAccount !== false && user.state === "pending" && user.activation === "invitation").length, Icon: Mail, tone: "warning" },
    ].map(({ label, value, Icon, tone }) => <div key={label} className="staff-metric" data-tone={tone}><span>{label}</span><Icon aria-hidden="true" /><strong>{value}</strong></div>)}</div>
    <div className="saas-filters">
      <SearchInput value={search} onChange={setSearch} ariaLabel="Buscar personal" placeholder="Nombre, usuario, correo, tipo o rol…" />
      <SaasSelect label="Rol" value={role} items={{ all: "Todos los roles", ...Object.fromEntries(catalog.map(item => [item.id, item.name])) }} onChange={setRole} />
      <SaasSelect label="Tipo de profesional" value={type} items={{ all: "Todos", ...Object.fromEntries(types.map(item => [item.id, item.name])) }} onChange={setType} />
      <SaasSelect label="Estado de cuenta" statusKind="account" value={state} items={{ all: "Todos", ...accountStates, "without-account": "Sin cuenta" }} onChange={setState} />
      <SaasSelect label="Estado profesional" statusKind="professional" value={professionalState} items={{ all: "Todos", ...professionalStates }} onChange={setProfessionalState} />
      <SaasSelect label="Especialidad" value={specialty} items={{ all: "Todas", ...Object.fromEntries(data.specialties.filter(item => item.organizationId === organizationId).map(item => [item.id, item.name])) }} onChange={setSpecialty} />
      <SaasSelect label="Sede" value={site} items={{ all: "Todas las sedes", ...Object.fromEntries(organization.branches.map(item => [item.id, item.name])) }} onChange={setSite} />
      <ResetFiltersButton disabled={!search && [role,type,state,site,specialty,professionalState].every(value => value === "all")} onReset={() => { setSearch(""); setRole("all"); setType("all"); setState("all"); setSite("all"); setSpecialty("all"); setProfessionalState("all") }} />
    </div>
    <div className="saas-actions"><Button size="sm" variant={cards ? "secondary" : "ghost"} aria-pressed={cards} onClick={() => setCards(true)}><LayoutGrid />Tarjetas</Button><Button size="sm" variant={!cards ? "secondary" : "ghost"} aria-pressed={!cards} onClick={() => setCards(false)}><List />Lista</Button></div>
    {cards ? <div className="saas-directory">{rows.map(user => <article className="saas-professional" key={user.id}>
      <div className="saas-person"><span className="saas-avatar">{user.firstName[0]}{user.lastName[0]}</span><div><h3>{nameOf(user)}</h3><p>{user.email || "Sin correo registrado"}</p></div>{actions(user)}</div>
      <p>{typeName(user)} · {specialtyNames(user)}</p><p>{siteNames(user)}</p><p>{user.hasAccount === false ? "Sin cuenta" : roleSummary(user, data, organizationId)}</p>
      <div className="saas-inline">{user.hasAccount !== false ? <AccountStatusBadge state={user.state} /> : <Button size="sm" variant="outline" onClick={() => setEditor({ user, account: true })}>Crear acceso</Button>}{user.professionalId && <><ProfessionalStatusBadge state={effectiveProfessionalState(user)} /><Button size="sm" variant="ghost" onClick={() => setStatusId(user.id)}>Cambiar estado</Button></>}</div>
    </article>)}{!rows.length && <p>No hay personas con estos filtros.</p>}</div> : <DataTable className="unified-staff-table" data={rows} columns={columns} getRowId={user => user.id} mobileTitleKey="person" />}
    {requests.length > 0 && <section className="saas-panel saas-stack"><h2>Solicitudes de acceso</h2>{requests.map(request => <div className="saas-inline" key={request.id}>
      <span>{nameOf(request)} · {request.username} · {({ pending: "Pendiente", reviewed: "Revisada", approved: "Aprobada", created: "Cuenta creada" })[request.state]}</span>
      {["pending", "reviewed"].includes(request.state) && <Button variant="outline" size="sm" onClick={() => updateDemoData(next => {
        const item = next.requests.find(item => item.id === request.id && item.organizationId === organizationId)
        if (item) item.state = item.state === "pending" ? "reviewed" : "approved"
      })}>{request.state === "pending" ? "Revisar" : "Aprobar"}</Button>}
      {request.state === "approved" && <Button size="sm" disabled={!profile} onClick={() => setEditor({ user: staffFromRequest(request, organization), account: true })}>Crear usuario con esos datos</Button>}
    </div>)}</section>}
    {editor && <StaffEditor key={(editor.user?.id ?? "new") + editor.account} user={editor.user} accountMode={editor.account} initialRole={editor.account ? "recepcion" : "medico"} onClose={() => setEditor(null)} />}
    {statusUser && <ProfessionalStatusDialog key={statusUser.id} user={statusUser} onClose={() => setStatusId(null)} />}
    {accessUser && <AccessManagementDialog user={accessUser} onClose={() => setAccessId(null)} />}
    {toggleUser && <ConfirmDialog open onOpenChange={open => !open && !busy && setToggleId(null)} title={toggleUser.state === "inactive" ? "Reactivar usuario" : "Desactivar usuario"} description={nameOf(toggleUser) + ". Se conservarán su identidad y sus registros. " + failure} confirmLabel={toggleUser.state === "inactive" ? "Reactivar" : "Desactivar"} destructive={toggleUser.state !== "inactive"} isLoading={busy} onConfirm={toggleAccount} />}
    {details && <Dialog open onOpenChange={open => !open && setDetailsId(null)}><DialogContent className="saas-scope">
      <DialogHeader><DialogTitle>{nameOf(details)}</DialogTitle><DialogDescription>Perfil administrativo</DialogDescription></DialogHeader><DialogBody><dl className="saas-summary">
        {[["Usuario", details.hasAccount === false ? "Sin cuenta" : details.username], ["Correo", details.email], ["Tipo de profesional", typeName(details)], ["Roles", roleSummary(details, data, organizationId)], ["Sedes", siteNames(details)], ["Especialidades", data.specialties.filter(item => item.organizationId === organizationId && details.specialtyIds.includes(item.id)).map(item => item.name).join(" · ")]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}
        {details.hasAccount !== false && <div><dt>Estado de cuenta</dt><dd><AccountStatusBadge state={details.state} /></dd></div>}
        {details.professionalId && <div><dt>Estado profesional</dt><dd><ProfessionalStatusBadge state={effectiveProfessionalState(details)} /></dd></div>}
      </dl></DialogBody><DialogFooter><Button variant="outline" onClick={() => setDetailsId(null)}>Cerrar</Button></DialogFooter>
    </DialogContent></Dialog>}
  </div>
}
