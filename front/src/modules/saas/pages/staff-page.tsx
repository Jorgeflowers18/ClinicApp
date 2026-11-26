import { useState } from "react"
import { CalendarDays, LayoutGrid, List, Mail, MoreHorizontal, Pencil, Plus, ShieldCheck, Stethoscope, UserRound, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { PageHeader } from "@/shared/components/page-header"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { SearchInput } from "@/shared/components/search-input"
import { ResetFiltersButton } from "@/shared/components/reset-filters-button"
import { roleLabels } from "@/modules/auth/types/user-admin.types"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useSaasData, useSessionUser } from "../state"
import { useStaffInstitution } from "../lib/institution-scope"
import { nameOf } from "../lib/identity"
import { effectiveProfessionalState } from "../lib/professional-policy"
import { demoStaffAdapter } from "../services"
import { updateDemoData } from "../adapters/demo-repository"
import { accountStates, professionalStates, type Specialty, type StaffUser } from "../types"
import { DemoNotice, AccountStatusBadge, ProfessionalStatusBadge, SaasSelect } from "../components/controls"
import { StaffEditor } from "../components/staff-editor"
import { ProfessionalStatusDialog } from "../components/professional-status-dialog"
import { SpecialtyManagement, SpecialtyEditor } from "../components/specialties"
import { AccessManagementDialog } from "../components/access-management-dialog"
import { staffFromRequest } from "../lib/staff-draft"
import "../saas.css"

export function StaffManagementPage() {
  const data = useSaasData(), { organizationId, organization, profile, error: institutionError } = useStaffInstitution(), actor = useSessionUser()
  const [tab, setTab] = useState("users"), [search, setSearch] = useState(""), [role, setRole] = useState("all")
  const [state, setState] = useState("all"), [professionalState, setProfessionalState] = useState("all")
  const [specialty, setSpecialty] = useState("all"), [site, setSite] = useState("all"), [cards, setCards] = useState(true)
  const [editor, setEditor] = useState<StaffUser | null | undefined>(), [specialtyEditor, setSpecialtyEditor] = useState<Specialty | null | undefined>()
  const [detailsId, setDetailsId] = useState<string | null>(null), [statusId, setStatusId] = useState<string | null>(null)
  const [accessId, setAccessId] = useState<string | null>(null), [toggleId, setToggleId] = useState<string | null>(null)
  const [failure, setFailure] = useState(""), [busy, setBusy] = useState(false)
  const needle = search.trim().toLocaleLowerCase("es")
  const all = data.users.filter(user => user.organizationIds.includes(organizationId))
  const requests = data.requests.filter(request => request.organizationId === organizationId)
  const rows = all.filter(user =>
    (!needle || [nameOf(user), user.username, user.email, ...data.specialties.filter(item => user.specialtyIds.includes(item.id)).map(item => item.name)].join(" ").toLocaleLowerCase("es").includes(needle))
    && (role === "all" || user.roles.includes(role as never)) && (state === "all" || user.state === state)
    && (tab !== "professionals" || professionalState === "all" || effectiveProfessionalState(user) === professionalState)
    && (specialty === "all" || user.specialtyIds.includes(specialty))
    && (site === "all" || user.assignments.some(item => item.organizationId === organizationId && item.siteId === site && item.active)))
  const clinical = rows.filter(user => user.professionalId)
  const details = all.find(user => user.id === detailsId), statusUser = all.find(user => user.id === statusId)
  const accessUser = all.find(user => user.id === accessId), toggleUser = all.find(user => user.id === toggleId)
  const siteNames = (user: StaffUser, compact = true) => {
    const names = organization.branches.filter(branch => user.assignments.some(item => item.organizationId === organizationId && item.siteId === branch.id && item.active)).map(item => item.name)
    const label = compact && names.length > 2 ? names.slice(0, 2).join(" · ") + ` +${names.length - 2}` : names.join(" · ")
    return <span title={names.join(" · ")}>{label || "Pendiente de asignar sede"}</span>
  }
  const specialtyNames = (user: StaffUser) => data.specialties.filter(item => user.specialtyIds.includes(item.id) && item.organizationId === organizationId).map(item => item.name).join(", ") || "—"

  function actions(user: StaffUser) {
    return <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${nameOf(user)}`} />}><MoreHorizontal /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="saas-user-menu">
        <DropdownMenuItem onClick={() => setDetailsId(user.id)}><UserRound />Ver perfil</DropdownMenuItem>
        <DropdownMenuItem disabled={!profile} onClick={() => setEditor(user)}><Pencil />Editar usuario</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setAccessId(user.id)}><ShieldCheck />Gestionar acceso</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant={user.state === "inactive" ? "default" : "destructive"} disabled={user.id === actor?.id}
          onClick={() => { setFailure(""); setToggleId(user.id) }}>
          {user.state === "inactive" ? <UserRoundCheck /> : <UserRoundX />}{user.state === "inactive" ? "Reactivar usuario" : "Desactivar usuario"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  }
  const columns: DataTableColumn<StaffUser>[] = [
    { key: "name", header: "Nombre completo", cell: user => <div className="saas-person"><span className="saas-avatar">{user.firstName[0]}{user.lastName[0]}</span><span>{nameOf(user)}</span></div> },
    { key: "username", header: "Usuario", cell: user => user.username },
    { key: "email", header: "Correo", cell: user => user.email },
    { key: "roles", header: "Rol", cell: user => <Badge variant="secondary">{user.roles.map(role => roleLabels[role]).join(", ")}</Badge> },
    { key: "specialty", header: "Especialidad", cell: specialtyNames },
    { key: "sites", header: "Sedes", cell: siteNames },
    { key: "state", header: "Estado de cuenta", cell: user => <AccountStatusBadge state={user.state} /> },
    { key: "actions", header: "", cell: actions },
  ]
  const professionalColumns: DataTableColumn<StaffUser>[] = [
    columns[0], columns[4], columns[5],
    { key: "professional-state", header: "Estado profesional", cell: user => <ProfessionalStatusBadge state={effectiveProfessionalState(user)} /> },
    { key: "actions", header: "", cell: user => <div className="saas-inline"><Button size="sm" variant="outline" onClick={() => setStatusId(user.id)}>Cambiar estado</Button>{actions(user)}</div> },
  ]
  async function toggleAccount() {
    if (!toggleUser || busy) return
    setBusy(true); setFailure("")
    try {
      await demoStaffAdapter.saveUser({ ...toggleUser, state: toggleUser.state === "inactive" ? toggleUser.activation === "invitation" ? "pending" : "active" : "inactive" })
      setToggleId(null)
    } catch (error) { setFailure(getErrorMessage(error)) }
    finally { setBusy(false) }
  }
  return <div className="saas-scope saas-stack staff-management">
    <PageHeader title="Personal y accesos" description="Administra los usuarios y profesionales de tu clínica"
      actions={tab === "specialties"
        ? <Button onClick={() => setSpecialtyEditor(null)}><Plus />Nueva especialidad</Button>
        : <Button disabled={!profile} onClick={() => setEditor(null)}><Plus />Nuevo usuario</Button>} />
    <DemoNotice />
    {Boolean(institutionError) && <p className="text-destructive" role="alert">{getErrorMessage(institutionError)}</p>}
    <div className="saas-metrics">
      {[
        { label: "Usuarios activos", value: all.filter(user => user.state === "active").length, Icon: UsersRound, tone: "success" },
        { label: "Profesionales activos", value: all.filter(user => user.professionalId && effectiveProfessionalState(user) === "ACTIVE").length, Icon: Stethoscope, tone: "success" },
        { label: "Profesionales de vacaciones", value: all.filter(user => user.professionalId && effectiveProfessionalState(user) === "VACATION").length, Icon: CalendarDays, tone: "info" },
        { label: "Invitaciones pendientes", value: all.filter(user => user.state === "pending" && user.activation === "invitation").length, Icon: Mail, tone: "warning" },
      ].map(({ label, value, Icon, tone }) => <div key={label} className="staff-metric" data-tone={tone}><span>{label}</span><Icon aria-hidden="true" /><strong>{value}</strong></div>)}
    </div>
    <Tabs value={tab} onValueChange={value => setTab(String(value))}>
      <div className="saas-tabs-scroll"><TabsList variant="line" aria-label="Personal y accesos">
        <TabsTrigger value="users">Usuarios</TabsTrigger><TabsTrigger value="professionals">Profesionales</TabsTrigger><TabsTrigger value="specialties">Especialidades</TabsTrigger>
      </TabsList></div>
      {(["users", "professionals"] as const).map(current => <TabsContent value={current} key={current}>
        <div className="saas-stack">
          <div className="saas-filters">
            <SearchInput value={search} onChange={setSearch} ariaLabel="Buscar personal" placeholder="Nombres, usuario, correo o especialidad…" />
            <SaasSelect label="Rol" value={role} items={{ all: "Todos los roles", ...roleLabels }} onChange={setRole} />
            <SaasSelect label="Estado de cuenta" value={state} items={{ all: "Todos", ...accountStates }} onChange={setState} />
            {current === "professionals" && <SaasSelect label="Estado profesional" value={professionalState} items={{ all: "Todos", ...professionalStates }} onChange={setProfessionalState} />}
            <SaasSelect label="Especialidad" value={specialty} items={{ all: "Todas", ...Object.fromEntries(data.specialties.filter(item => item.organizationId === organizationId).map(item => [item.id, item.name])) }} onChange={setSpecialty} />
            <SaasSelect label="Sede" value={site} items={{ all: "Todas las sedes", ...Object.fromEntries((organization?.branches ?? []).map(item => [item.id, item.name])) }} onChange={setSite} />
            <ResetFiltersButton disabled={!search && role === "all" && state === "all" && professionalState === "all" && specialty === "all" && site === "all"}
              onReset={() => { setSearch(""); setRole("all"); setState("all"); setProfessionalState("all"); setSpecialty("all"); setSite("all") }} />
          </div>
          {current === "professionals" && <div className="saas-actions">
            <Button size="sm" variant={cards ? "secondary" : "ghost"} aria-pressed={cards} onClick={() => setCards(true)}><LayoutGrid />Tarjetas</Button>
            <Button size="sm" variant={!cards ? "secondary" : "ghost"} aria-pressed={!cards} onClick={() => setCards(false)}><List />Lista</Button>
          </div>}
          {current === "professionals" && cards ? <div className="saas-directory">
            {clinical.map(user => <article className="saas-professional" key={user.id}>
              <div className="saas-person"><span className="saas-avatar"><UserRound /></span><div><h3>{nameOf(user)}</h3><p>{specialtyNames(user) === "—" ? user.profession || "Especialidad pendiente" : specialtyNames(user)}</p></div>{actions(user)}</div>
              <p>{siteNames(user)}</p>
              <div className="saas-professional-state"><ProfessionalStatusBadge state={effectiveProfessionalState(user)} /><Button size="sm" variant="ghost" onClick={() => setStatusId(user.id)}>Cambiar estado</Button></div>
            </article>)}
            {!clinical.length && <p>No hay profesionales con estos filtros.</p>}
          </div> : <DataTable className={current === "users" ? "staff-users-table" : undefined} data={current === "users" ? rows : clinical} columns={current === "users" ? columns : professionalColumns} getRowId={user => user.id} mobileTitleKey="name" />}
          {current === "users" && requests.length > 0 && <section className="saas-panel saas-stack">
            <h2>Solicitudes de acceso</h2>
            {requests.map(request => <div className="saas-inline" key={request.id}>
              <span>{nameOf(request)} · {request.username} · {({ pending: "Pendiente", reviewed: "Revisada", approved: "Aprobada", created: "Cuenta creada" })[request.state]}</span>
              {["pending", "reviewed"].includes(request.state) && <Button variant="outline" size="sm" onClick={() => updateDemoData(next => {
                const item = next.requests.find(item => item.id === request.id)!; item.state = item.state === "pending" ? "reviewed" : "approved"
              })}>{request.state === "pending" ? "Revisar" : "Aprobar"}</Button>}
              {request.state === "approved" && <Button size="sm" onClick={() => organization && setEditor(staffFromRequest(request, organization))}>Crear usuario con esos datos</Button>}
            </div>)}
          </section>}
        </div>
      </TabsContent>)}
      <TabsContent value="specialties"><SpecialtyManagement onEdit={setSpecialtyEditor} /></TabsContent>
    </Tabs>
    {specialtyEditor !== undefined && <SpecialtyEditor key={specialtyEditor?.id ?? "new"} specialty={specialtyEditor} organizationId={organizationId} onClose={() => setSpecialtyEditor(undefined)} />}
    {editor !== undefined && <StaffEditor key={editor?.id ?? "new"} user={editor} initialRole={tab === "professionals" ? "medico" : "recepcion"} onClose={() => setEditor(undefined)} />}
    {statusUser && <ProfessionalStatusDialog key={statusUser.id} user={statusUser} onClose={() => setStatusId(null)} />}
    {accessUser && <AccessManagementDialog user={accessUser} onClose={() => setAccessId(null)} />}
    {toggleUser && <ConfirmDialog open onOpenChange={open => !open && !busy && setToggleId(null)}
      title={toggleUser.state === "inactive" ? "Reactivar usuario" : "Desactivar usuario"}
      description={`${nameOf(toggleUser)}. Se conservarán su identidad, citas y registros.${failure ? " " + failure : ""}`}
      confirmLabel={toggleUser.state === "inactive" ? "Reactivar" : "Desactivar"} destructive={toggleUser.state !== "inactive"} isLoading={busy} onConfirm={toggleAccount} />}
    {details && <Dialog open onOpenChange={open => !open && setDetailsId(null)}>
      <DialogContent className="saas-scope"><DialogHeader><DialogTitle>{nameOf(details)}</DialogTitle><DialogDescription>Perfil del personal</DialogDescription></DialogHeader>
        <DialogBody><dl className="saas-summary">
          {[["Usuario", details.username], ["Correo", details.email], ["Teléfono", details.phone], ["Rol", details.roles.map(role => roleLabels[role]).join(", ")], ["Sedes", siteNames(details, false)]].map(([label, value], index) => <div key={index}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}
          <div><dt>Estado de cuenta</dt><dd><AccountStatusBadge state={details.state} /></dd></div>
          {details.professionalId && <div><dt>Estado profesional</dt><dd><ProfessionalStatusBadge state={effectiveProfessionalState(details)} /></dd></div>}
        </dl></DialogBody><DialogFooter><Button variant="outline" onClick={() => setDetailsId(null)}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
  </div>
}
