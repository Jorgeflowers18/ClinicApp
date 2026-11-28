import { useRef, useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { AdaptiveTabs } from "@/components/ui/adaptive-tabs"
import { TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { AdministrativeStatusBadge } from "@/shared/components/administrative-status-badge"
import { useValidatedForm } from "@/shared/hooks/use-validated-form"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"
import { getErrorMessage } from "@/shared/lib/error-message"
import { RoleModuleSelector } from "./role-module-selector"
import styles from "./administrative-ui.module.css"
import { useSaasData, useDemoContext, useSessionUser } from "../state"
import { navItems, navigationSections } from "@/app/nav-config"
import { canViewNavigationItem } from "../lib/navigation-visibility"
import { permissionModuleForPath } from "../lib/permissions"
import { useUsers } from "@/modules/auth/api/users.queries"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { accessRoles, assignedRoles } from "../lib/access-catalogs"
import { useStaffInstitution } from "../lib/institution-scope"
import { catalogService } from "../catalog-services"
import { demoId } from "../adapters/demo-repository"
import type { AccessRole, ProfessionalType } from "../types"

type CatalogItem = AccessRole | ProfessionalType
export function AccessCatalogManagement() {
  const [tab, setTab] = useState("types")
  return <AdaptiveTabs value={tab} onValueChange={setTab} variant="line" items={[{ value: "types", label: "Tipos de profesionales" }, { value: "roles", label: "Roles" }]}>
    <TabsContent value="types"><CatalogManagement kind="type" /></TabsContent>
    <TabsContent value="roles"><CatalogManagement kind="role" /></TabsContent>
  </AdaptiveTabs>
}
export function CatalogManagement({ kind, heading }: { kind: "type" | "role"; heading?: { title: string; description: string; headingLevel?: 1 | 2 } }) {
  const data = useSaasData(), { organizationId } = useStaffInstitution()
  const demo = useDemoContext(state => state.userId), users = useUsers({ enabled: !demo && kind === "role" })
  const professionals = useProfessionals({ enabled: !demo && kind === "type" })
  const [editor, setEditor] = useState<CatalogItem | null | undefined>(), [toggle, setToggle] = useState<CatalogItem | null>(null)
  const [failure, setFailure] = useState(""), [busy, setBusy] = useState(false)
  const items = kind === "role" ? accessRoles(data, organizationId) : data.professionalTypes?.filter(item => item.organizationId === organizationId) ?? []
  const save = (item: CatalogItem) => kind === "role" ? catalogService.saveRole(item as AccessRole) : catalogService.saveType(item)
  async function toggleItem(item: CatalogItem) {
    if (busy) return
    setBusy(true); setFailure("")
    try { await save({ ...item, active: !item.active }); setToggle(null) }
    catch (error) { setFailure(getErrorMessage(error)) }
    finally { setBusy(false) }
  }
  return <div className="saas-stack">
    {heading ? <PageHeader {...heading} actions={<Button onClick={() => setEditor(null)}><Plus />{kind === "role" ? "Nuevo rol" : "Nuevo tipo"}</Button>}/> : <div className="saas-actions"><Button onClick={() => setEditor(null)}><Plus />{kind === "role" ? "Nuevo rol" : "Nuevo tipo"}</Button></div>}
    {failure && <p role="alert" className="text-destructive">{failure}</p>}
    <DataTable className={styles.table} data={items} getRowId={item => item.id} mobileTitleKey="name" columns={[
      { key: "name", header: kind === "role" ? "Rol" : "Tipo de profesional", cell: item => item.name },
      { key: "description", header: "Descripción", cell: item => item.description || "—" },
      ...(kind === "role" ? [{ key: "users", header: "Usuarios", cell: (item: CatalogItem) => demo
        ? new Set(data.users.filter(user => user.hasAccount !== false && user.organizationIds.includes(organizationId) && assignedRoles(user, data, organizationId).some(role => role.id === item.id)).map(user => user.id)).size
        : users.data ? new Set(users.data.filter(user => assignedRoles({ roles: [user.role], accessRoleIds: data.serverStaffSettings?.[organizationId]?.[user.id]?.accessRoleIds }, data, organizationId).some(role => role.id === item.id)).map(user => user.id)).size : "—"
      }] : [{ key: "professionals", header: "Profesionales", cell: (item: CatalogItem) => demo
        ? new Set(data.users.filter(user => user.professionalId && user.organizationIds.includes(organizationId) && user.professionalTypeId === item.id).map(user => user.professionalId)).size
        : professionals.data ? new Set(professionals.data.filter(person => (data.serverStaffSettings?.[organizationId]?.[person.userId ?? ""]?.professionalTypeId ?? data.serverStaffSettings?.[organizationId]?.["professional:" + person.id]?.professionalTypeId) === item.id).map(person => person.id)).size : "—"
      }]),
      { key: "state", header: "Estado", cell: item => <AdministrativeStatusBadge kind="resource" state={item.active ? "active" : "inactive"} /> },
      { key: "actions", header: "Acciones", cell: item => <div className="staff-specialty-actions">
        <Button size="sm" variant="outline" onClick={() => setEditor(item)}><Pencil />Editar</Button>
        <Button size="sm" variant="outline" disabled={busy || "builtin" in item && item.builtin === "admin"} onClick={() => item.active ? (setFailure(""), setToggle(item)) : void toggleItem(item)}><Power />{item.active ? "Desactivar" : "Activar"}</Button>
      </div> },
    ]} />
    {editor !== undefined && <CatalogEditor kind={kind} item={editor} organizationId={organizationId} onClose={() => setEditor(undefined)} />}
    {toggle && <ConfirmDialog open onOpenChange={open => !open && !busy && setToggle(null)} title={kind === "role" ? "Desactivar rol" : "Desactivar tipo profesional"}
      description={`«${toggle.name}» no se ofrecerá en nuevas asignaciones. Sus referencias se conservarán.${kind === "role" ? " Sus permisos dejarán de aplicarse en el entorno de demostración." : ""}${failure ? " " + failure : ""}`}
      confirmLabel="Desactivar" isLoading={busy} onConfirm={() => void toggleItem(toggle)} />}
  </div>
}
const schema = z.object({ name: z.string().trim().min(1, "Ingresa el nombre.").max(80, "Hasta 80 caracteres."), description: z.string().max(300, "Hasta 300 caracteres."), active: z.boolean(), sections: z.array(z.string()) })
function CatalogEditor({ kind, item, organizationId, onClose }: { kind: "type" | "role"; item: CatalogItem | null; organizationId: string; onClose: () => void }) {
  const actor = useSessionUser(), data = useSaasData(), context = useDemoContext()
  const member = data.users.find(user => user.id === context.userId)
  const assignableIds = navigationSections.filter(module => {
    const navigation = navItems.find(item => permissionModuleForPath(item.to) === module.id)
      ?? (module.id === "Perfil institucional" ? { to: "/perfil-institucion", roles: ["admin" as const] } : undefined)
    return navigation && canViewNavigationItem(navigation, { user: actor, member, data, organizationId })
  }).map(module => module.id)
  const root = useRef<HTMLDivElement>(null), [failure, setFailure] = useState("")
  const form = useValidatedForm({ resolver: zodResolver(schema), defaultValues: { name: item?.name ?? "", description: item?.description ?? "", active: item?.active ?? true, sections: item && "sections" in item ? item.sections : [] } }, root)
  const values = form.watch(), errors = form.formState.errors, protectedRole = item && "builtin" in item && item.builtin === "admin"
  const moduleErrors = Object.fromEntries(values.sections.flatMap((id, index) => {
    const message = errors.sections?.[index]?.message
    return message ? [[id, message]] : []
  }))
  const sectionError = errors.sections?.message ?? errors.sections?.root?.message
  function close() { if (!form.formState.isSubmitting && (!form.formState.isDirty || confirm("¿Descartar los cambios del catálogo?"))) onClose() }
  return <Dialog open onOpenChange={open => !open && close()}><DialogContent variant={kind === "type" ? "medium" : "wide"} className={`saas-scope ${styles.catalogDialog} ${kind === "type" ? styles.typeDialog : styles.roleDialog}`}>
    <DialogHeader><DialogTitle>{kind === "role" ? item ? "Editar rol" : "Nuevo rol" : item ? "Editar tipo profesional" : "Nuevo tipo"}</DialogTitle><DialogDescription>{kind === "role" ? "Define los módulos que estarán disponibles para este rol." : "Define el tipo de profesional y su estado."}</DialogDescription></DialogHeader>
    <DialogBody ref={root} className={styles.catalogBody}><form id="access-catalog-form" className={styles.catalogForm} noValidate onSubmit={event => void form.handleSubmit(async values => {
      setFailure("")
      try {
        const next = { ...values, id: item?.id ?? demoId(), organizationId }
        if (kind === "role") await catalogService.saveRole({ ...next, builtin: item && "builtin" in item ? item.builtin : undefined })
        else await catalogService.saveType(next)
        onClose()
      } catch (error) { if (!applyServerFieldErrors(form, error).length) setFailure(getErrorMessage(error)) }
    })(event)}>
      <Field data-invalid={Boolean(errors.name)}><FieldLabel htmlFor="catalog-name">Nombre *</FieldLabel><Input id="catalog-name" {...form.register("name")} readOnly={Boolean(protectedRole)} aria-invalid={Boolean(errors.name)} /><FieldError>{errors.name?.message}</FieldError></Field>
      <Field data-invalid={Boolean(errors.description)}><FieldLabel htmlFor="catalog-description">Descripción <span className="saas-hint">(opcional)</span></FieldLabel><Textarea id="catalog-description" className={styles.description} {...form.register("description")} maxLength={300} aria-invalid={Boolean(errors.description)} /><FieldError>{errors.description?.message}</FieldError></Field>
      <Field orientation="horizontal" className={styles.state}><FieldLabel htmlFor="catalog-active">Estado</FieldLabel><AdministrativeStatusBadge kind="resource" state={values.active ? "active" : "inactive"} /><Switch id="catalog-active" aria-label="Activo" checked={values.active} disabled={Boolean(protectedRole)} onCheckedChange={checked => form.setValue("active", checked, { shouldDirty: true })} /></Field>
      {kind === "role" && <Field data-invalid={Boolean(errors.sections)}><RoleModuleSelector value={values.sections} assignableIds={assignableIds} protectedRole={Boolean(protectedRole)} disabled={form.formState.isSubmitting} invalid={Boolean(errors.sections)} moduleErrors={moduleErrors} errorMessage={sectionError} validationAttempt={form.formState.submitCount} revealInvalid={!errors.name && !errors.description && !errors.active} onChange={sections => form.setValue("sections", sections, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}/><FieldError id="catalog-sections-error">{sectionError}</FieldError></Field>}
      {failure && <p role="alert" className="text-destructive">{failure}</p>}
    </form></DialogBody><DialogFooter><Button variant="outline" onClick={close}>Cancelar</Button><Button form="access-catalog-form" type="submit" disabled={form.formState.isSubmitting}>{item ? "Guardar cambios" : "Guardar"}</Button></DialogFooter>
  </DialogContent></Dialog>
}
