import { useRef, useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { AdaptiveTabs } from "@/components/ui/adaptive-tabs"
import { TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "@/shared/components/data-table"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { AdministrativeStatusBadge } from "@/shared/components/administrative-status-badge"
import { useValidatedForm } from "@/shared/hooks/use-validated-form"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"
import { getErrorMessage } from "@/shared/lib/error-message"
import { navigationSections } from "@/app/nav-config"
import { useSaasData, useDemoContext } from "../state"
import { useUsers } from "@/modules/auth/api/users.queries"
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
function CatalogManagement({ kind }: { kind: "type" | "role" }) {
  const data = useSaasData(), { organizationId } = useStaffInstitution()
  const demo = useDemoContext(state => state.userId), users = useUsers({ enabled: !demo && kind === "role" })
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
    <div className="saas-actions"><Button onClick={() => setEditor(null)}><Plus />{kind === "role" ? "Nuevo rol" : "Nuevo tipo"}</Button></div>
    {failure && <p role="alert" className="text-destructive">{failure}</p>}
    <DataTable data={items} getRowId={item => item.id} mobileTitleKey="name" columns={[
      { key: "name", header: kind === "role" ? "Rol" : "Tipo de profesional", cell: item => item.name },
      { key: "description", header: "Descripción", cell: item => item.description || "—" },
      ...(kind === "role" ? [{ key: "users", header: "Usuarios", cell: (item: CatalogItem) => demo
        ? data.users.filter(user => user.hasAccount !== false && user.organizationIds.includes(organizationId) && assignedRoles(user, data, organizationId).some(role => role.id === item.id)).length
        : users.data ? users.data.filter(user => assignedRoles({ roles: [user.role], accessRoleIds: data.serverStaffSettings?.[organizationId]?.[user.id]?.accessRoleIds }, data, organizationId).some(role => role.id === item.id)).length : "—"
      }] : []),
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
  const root = useRef<HTMLDivElement>(null), [failure, setFailure] = useState("")
  const form = useValidatedForm({ resolver: zodResolver(schema), defaultValues: { name: item?.name ?? "", description: item?.description ?? "", active: item?.active ?? true, sections: item && "sections" in item ? item.sections : [] } }, root)
  const values = form.watch(), errors = form.formState.errors, protectedRole = item && "builtin" in item && item.builtin === "admin"
  function close() { if (!form.formState.isSubmitting && (!form.formState.isDirty || confirm("¿Descartar los cambios del catálogo?"))) onClose() }
  return <Dialog open onOpenChange={open => !open && close()}><DialogContent variant={kind === "role" ? "wide" : "medium"} className="saas-scope">
    <DialogHeader><DialogTitle>{kind === "role" ? item ? "Editar rol" : "Nuevo rol" : item ? "Editar tipo profesional" : "Nuevo tipo"}</DialogTitle><DialogDescription>{kind === "role" ? "Selecciona las secciones visibles. La autorización del servidor conserva sus restricciones." : "El tipo profesional se administra por separado de las especialidades y los roles."}</DialogDescription></DialogHeader>
    <DialogBody ref={root}><form id="access-catalog-form" className="saas-stack" noValidate onSubmit={form.handleSubmit(async values => {
      setFailure("")
      try {
        const next = { ...values, id: item?.id ?? demoId(), organizationId }
        if (kind === "role") await catalogService.saveRole({ ...next, builtin: item && "builtin" in item ? item.builtin : undefined })
        else await catalogService.saveType(next)
        onClose()
      } catch (error) { if (!applyServerFieldErrors(form, error).length) setFailure(getErrorMessage(error)) }
    })}>
      <Field data-invalid={Boolean(errors.name)}><FieldLabel htmlFor="catalog-name">Nombre *</FieldLabel><Input id="catalog-name" {...form.register("name")} readOnly={Boolean(protectedRole)} aria-invalid={Boolean(errors.name)} /><FieldError>{errors.name?.message}</FieldError></Field>
      <Field><FieldLabel htmlFor="catalog-description">Descripción</FieldLabel><Textarea id="catalog-description" {...form.register("description")} maxLength={300} /></Field>
      <Field orientation="horizontal"><FieldLabel className="flex-1" htmlFor="catalog-active">Estado</FieldLabel><AdministrativeStatusBadge kind="resource" state={values.active ? "active" : "inactive"} /><Switch id="catalog-active" aria-label="Activo" checked={values.active} disabled={Boolean(protectedRole)} onCheckedChange={checked => form.setValue("active", checked, { shouldDirty: true })} /></Field>
      {kind === "role" && <Field data-invalid={Boolean(errors.sections)}><FieldLabel>Acceso a módulos</FieldLabel><div className="saas-module-checks" data-validation-field="sections" tabIndex={-1}>
        {navigationSections.map(section => <label className="saas-check" key={section.id}><Checkbox checked={values.sections.includes(section.id)} disabled={Boolean(protectedRole && ["Administración", "Personal y accesos"].includes(section.id))} onCheckedChange={checked => form.setValue("sections", checked ? [...values.sections, section.id] : values.sections.filter(id => id !== section.id), { shouldDirty: true })} />{section.label}</label>)}
      </div><FieldError>{errors.sections?.message}</FieldError></Field>}
      {failure && <p role="alert" className="text-destructive">{failure}</p>}
    </form></DialogBody><DialogFooter><Button variant="outline" onClick={close}>Cancelar</Button><Button form="access-catalog-form" type="submit" disabled={form.formState.isSubmitting}>Guardar cambios</Button></DialogFooter>
  </DialogContent></Dialog>
}
