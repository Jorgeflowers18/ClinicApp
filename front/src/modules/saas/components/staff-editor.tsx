import { useRef, useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Building2, ChevronDown, KeyRound, ShieldCheck, Stethoscope, UserRound } from "lucide-react"
import { useValidatedForm } from "@/shared/hooks/use-validated-form"
import { useModalAccordion } from "@/shared/hooks/use-modal-accordion"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"
import { getErrorMessage } from "@/shared/lib/error-message"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { roles, type Role } from "@/modules/auth/types/auth.types"
import { roleLabels } from "@/modules/auth/types/user-admin.types"
import { demoId } from "../adapters/demo-repository"
import { usernameSchema, nameOf } from "../lib/identity"
import { effectiveProfessionalState } from "../lib/professional-policy"
import { demoStaffAdapter } from "../services"
import { useSaasData } from "../state"
import { useStaffInstitution } from "../lib/institution-scope"
import { useSaveInstitutionProfile } from "@/modules/institution/api/institution.queries"
import { InstitutionBranches } from "@/modules/institution/components/institution-branches"
import { accountStates, type StaffUser } from "../types"
import { ProfessionalStatusBadge, SaasSelect, UsernameField } from "./controls"

const schedule = z.object({ days: z.array(z.number()), start: z.string(), end: z.string() })
const schema = z.object({
  firstName: z.string().trim().min(1, "Ingresa los nombres."), lastName: z.string().trim().min(1, "Ingresa los apellidos."),
  username: usernameSchema, email: z.string().trim().email("Ingresa un correo válido."),
  phone: z.string().trim().refine(value => !value || /^\+?[\d ()-]{7,20}$/.test(value), "Ingresa un teléfono válido."),
  documentType: z.string(), documentNumber: z.string(), role: z.enum(roles),
  siteIds: z.array(z.string()), mainSiteId: z.string(),
  schedules: z.record(schedule), profession: z.string(), registration: z.string(), specialtyIds: z.array(z.string()),
  state: z.enum(["active", "inactive", "blocked", "pending"]), activation: z.enum(["invitation", "temporary", "active"]),
}).superRefine((value, context) => {
  if (value.mainSiteId && !value.siteIds.includes(value.mainSiteId)) context.addIssue({ code: "custom", path: ["mainSiteId"], message: "La sede principal debe estar asignada." })
  if (value.siteIds.length && !value.mainSiteId) context.addIssue({ code: "custom", path: ["mainSiteId"], message: "Selecciona la sede principal." })
  if (value.role !== "medico") return
  if (!value.profession.trim()) context.addIssue({ code: "custom", path: ["profession"], message: "Indica la profesión." })
  if (!value.specialtyIds.length) context.addIssue({ code: "custom", path: ["specialtyIds"], message: "Asigna al menos una especialidad." })
  for (const id of value.siteIds) {
    const item = value.schedules[id]
    if (!item?.days.length) context.addIssue({ code: "custom", path: ["schedules", id, "days"], message: "Selecciona al menos un día de atención." })
    if (!item?.start) context.addIssue({ code: "custom", path: ["schedules", id, "start"], message: "Indica la hora de inicio." })
    if (!item?.end || item.end <= item.start) context.addIssue({ code: "custom", path: ["schedules", id, "end"], message: "El cierre debe ser posterior al inicio." })
  }
})
type Values = z.infer<typeof schema>
const groups = [
  { id: "personal", title: "Datos personales", fields: ["firstName", "lastName", "email", "phone", "documentType", "documentNumber"] },
  { id: "credentials", title: "Credenciales", fields: ["username", "state"] },
  { id: "assignments", title: "Rol y sede", fields: ["role", "siteIds", "mainSiteId", "schedules"] },
  { id: "professional", title: "Perfil profesional", fields: ["profession", "registration", "specialtyIds"] },
  { id: "activation", title: "Activación", fields: ["activation"] },
]
const activationLabels = { invitation: "Invitación pendiente", temporary: "Contraseña temporal · cambio obligatorio", active: "Cuenta activa" }
export function StaffEditor({ user, onClose, initialRole = "recepcion" }: { user: StaffUser | null; onClose: () => void; initialRole?: Role }) {
  const data = useSaasData(), { organizationId, organization, profile } = useStaffInstitution(), body = useRef<HTMLDivElement>(null), lock = useRef(false)
  const sites = organization.branches, saveInstitution = useSaveInstitutionProfile()
  const [creatingSite, setCreatingSite] = useState(false)
  const accordion = useModalAccordion(body, "personal")
  const [failure, setFailure] = useState("")
  const existingRole = user?.roles.includes("admin") ? "admin" : user?.roles[0] ?? initialRole
  const form = useValidatedForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", username: user?.username ?? "", email: user?.email ?? "", phone: user?.phone ?? "",
      documentType: user?.documentType ?? "cedula", documentNumber: user?.documentNumber ?? "", role: existingRole,
      siteIds: user?.assignments.filter(item => item.active && item.organizationId === organizationId && sites.some(site => site.id === item.siteId)).map(item => item.siteId) ?? [],
      mainSiteId: user?.assignments.find(item => item.active && item.main && item.organizationId === organizationId && sites.some(site => site.id === item.siteId))?.siteId ?? "",
      schedules: Object.fromEntries(sites.map(site => {
        const previous = user?.assignments.find(item => item.siteId === site.id && item.organizationId === organizationId)
        return [site.id, { days: previous?.days ?? [1, 2, 3, 4, 5], start: previous?.start ?? "08:00", end: previous?.end ?? "18:00" }]
      })),
      profession: user?.profession ?? "", registration: user?.registration ?? "",
      specialtyIds: user?.specialtyIds.filter(id => data.specialties.some(item => item.id === id && item.organizationId === organizationId)) ?? [],
      state: user?.state ?? "pending", activation: user?.activation ?? "invitation",
    },
  }, body)
  const values = form.watch(), errors = form.formState.errors, clinical = values.role === "medico"
  const visibleGroups = groups.filter(group => group.id !== "professional" || clinical)
  function reveal(field: string) {
    const group = visibleGroups.find(group => group.fields.some(key => key === field || field.startsWith(key + ".")))
    if (group) accordion.request(group.id, `[name="${CSS.escape(field)}"],[data-validation-field="${CSS.escape(field)}"],#staff-${CSS.escape(field)}`)
  }
  const text = (key: "firstName" | "lastName" | "email" | "phone" | "documentNumber" | "profession" | "registration", label: string, type = "text") =>
    <Field data-invalid={Boolean(errors[key])}><FieldLabel htmlFor={`staff-${key}`}>{label}{["firstName", "lastName", "email"].includes(key) && " *"}</FieldLabel>
      <Input id={`staff-${key}`} type={type} {...form.register(key)} aria-invalid={Boolean(errors[key])} /><FieldError>{errors[key]?.message}</FieldError>
    </Field>
  async function save(next: Values) {
    if (lock.current) return
    lock.current = true; setFailure("")
    try {
      const unavailable = next.siteIds.find(id => !sites.some(site => site.id === id))
      if (unavailable) {
        form.setError("mainSiteId", { message: "La sede seleccionada ya no está disponible. Revisa la asignación." })
        reveal("mainSiteId")
        return
      }
      const previous = data.users.find(item => item.id === user?.id) ?? user
      const currentAssignments = sites.filter(site => next.siteIds.includes(site.id)).map(site => ({
        organizationId, siteId: site.id, main: next.mainSiteId === site.id, active: true,
        ...(next.schedules[site.id] ?? { days: [1, 2, 3, 4, 5], start: "08:00", end: "18:00" }),
      }))
      const assignments = [
        ...(previous?.assignments ?? []).filter(item => item.organizationId !== organizationId),
        ...(previous?.assignments ?? []).filter(item => item.organizationId === organizationId && !next.siteIds.includes(item.siteId)).map(item => ({ ...item, active: false, main: false })),
        ...currentAssignments,
      ]
      await demoStaffAdapter.saveUser({
        id: previous?.id ?? demoId(), firstName: next.firstName, lastName: next.lastName, username: next.username, email: next.email, phone: next.phone,
        documentType: next.documentType, documentNumber: next.documentNumber, roles: [next.role], state: next.state,
        organizationIds: [...new Set([...(previous?.organizationIds ?? []), organizationId])], assignments,
        professionalId: clinical ? previous?.professionalId ?? demoId() : previous?.professionalId ?? null,
        profession: clinical ? next.profession : previous?.profession ?? "", registration: clinical ? next.registration : previous?.registration ?? "",
        specialtyIds: clinical ? [...(previous?.specialtyIds ?? []).filter(id => data.specialties.some(item => item.id === id && item.organizationId !== organizationId)), ...next.specialtyIds] : previous?.specialtyIds ?? [],
        professionalState: clinical ? previous?.professionalState ?? "ACTIVE" : previous?.professionalId ? "INACTIVE" : "ACTIVE",
        absences: previous?.absences ?? [], activation: next.activation,
        mustChangePassword: next.activation === previous?.activation ? previous.mustChangePassword : next.activation === "temporary",
        profile: previous?.profile ? { ...previous.profile, fullName: nameOf(next) } : null, createdAt: previous?.createdAt ?? new Date().toISOString(),
      })
      onClose()
    } catch (error) {
      const issues = applyServerFieldErrors(form, error)
      if (issues[0]) reveal(issues[0].field); else setFailure(getErrorMessage(error))
    } finally { lock.current = false }
  }
  const contents = {
    personal: <div className="saas-grid">
      {text("firstName", "Nombres")}{text("lastName", "Apellidos")}
      <SaasSelect label="Tipo de documento" items={{ cedula: "Cédula", pasaporte: "Pasaporte", otro: "Otro documento" }} value={values.documentType} onChange={value => form.setValue("documentType", value, { shouldDirty: true })} />
      {text("documentNumber", "Número de documento")}{text("email", "Correo de acceso", "email")}{text("phone", "Teléfono", "tel")}
    </div>,
    credentials: <div className="saas-stack">
      <UsernameField value={values.username} onChange={value => form.setValue("username", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} firstName={values.firstName} lastName={values.lastName} accountId={user?.id} error={errors.username?.message} required />
      <SaasSelect label="Estado de cuenta" id="state" value={values.state} error={errors.state?.message} items={accountStates} onChange={value => form.setValue("state", value as Values["state"], { shouldDirty: true })} />
    </div>,
    assignments: <div className="saas-stack">
      <div className="saas-grid">
        <SaasSelect label="Rol *" id="role" value={values.role} items={roleLabels} error={errors.role?.message} onChange={value => form.setValue("role", value as Role, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} />
        <div className="saas-field"><span>Institución</span><p className="saas-readonly">{organization.name}</p></div>
      </div>
      {!sites.length && <div className="saas-stack saas-empty-sites"><p>Todavía no hay sedes registradas.</p><p className="saas-hint">Crea una sede desde Perfil institucional para asignar personal.</p><Button type="button" variant="outline" size="sm" disabled={!profile} onClick={() => setCreatingSite(true)}>Crear primera sede</Button></div>}
      {(sites.length > 0 || values.siteIds.length > 0) && <div className={sites.length > 1 ? "saas-grid" : "saas-stack"}>
      <SaasSelect label="Sede principal" id="mainSiteId" value={values.mainSiteId || "none"} error={errors.mainSiteId?.message}
        items={{ none: "Pendiente de asignar sede", ...(values.mainSiteId && !sites.some(site => site.id === values.mainSiteId) ? { [values.mainSiteId]: "Sede no disponible" } : {}), ...Object.fromEntries(sites.map(site => [site.id, site.name])) }}
        onChange={value => {
          const selected = value === "none" ? "" : value
          form.setValue("mainSiteId", selected, { shouldDirty: true, shouldValidate: true })
          if (selected) {
            form.setValue("siteIds", [...new Set([...values.siteIds, selected])], { shouldDirty: true, shouldValidate: true })
            if (!values.schedules[selected]) form.setValue(`schedules.${selected}`, { days: [1, 2, 3, 4, 5], start: "08:00", end: "18:00" })
          } else form.setValue("siteIds", [], { shouldDirty: true, shouldValidate: true })
        }} />
      {sites.length > 1 && <Field data-invalid={Boolean(errors.siteIds)}><FieldLabel>Sedes adicionales</FieldLabel>
        <div className="saas-checks">{sites.filter(site => site.id !== values.mainSiteId).map(site => <label className="saas-check" key={site.id}>
          <Checkbox checked={values.siteIds.includes(site.id)} onCheckedChange={checked => {
            form.setValue("siteIds", checked ? [...new Set([...values.siteIds, site.id])] : values.siteIds.filter(id => id !== site.id), { shouldDirty: true, shouldValidate: true })
            if (checked && !values.schedules[site.id]) form.setValue(`schedules.${site.id}`, { days: [1, 2, 3, 4, 5], start: "08:00", end: "18:00" })
          }} />{site.name}
        </label>)}</div><FieldError>{errors.siteIds?.message}</FieldError>
        {!sites.length && <p className="saas-hint">Configura las sedes desde Perfil institucional antes de asignar personal.</p>}
      </Field>}
      </div>}
      {values.siteIds.some(id => !sites.some(site => site.id === id)) && <div className="saas-stack">
        <p className="saas-hint">Una sede asignada dejó de estar disponible. Revisa las asignaciones antes de guardar.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => {
          form.setValue("siteIds", values.siteIds.filter(id => sites.some(site => site.id === id)), { shouldDirty: true, shouldValidate: true })
          if (!sites.some(site => site.id === values.mainSiteId)) form.setValue("mainSiteId", "", { shouldDirty: true, shouldValidate: true })
          form.clearErrors("mainSiteId")
        }}>Quitar sedes no disponibles</Button>
      </div>}
      {errors.mainSiteId && !sites.length && <FieldError>{errors.mainSiteId.message}</FieldError>}
      {clinical && !values.siteIds.length && <p className="saas-hint">Pendiente de asignar sede. No estará disponible para nuevas citas.</p>}
      {clinical && sites.filter(site => values.siteIds.includes(site.id)).map(site => {
        const item = values.schedules[site.id] ?? { days: [1, 2, 3, 4, 5], start: "08:00", end: "18:00" }, issues = errors.schedules?.[site.id]
        return <fieldset key={site.id} className="saas-schedule">
          <legend>Horario · {site.name}</legend>
          <Field data-invalid={Boolean(issues?.days)}><FieldLabel>Días de atención</FieldLabel><div className="saas-checks">
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((label, day) => <label className="saas-check" key={day}><Checkbox checked={item.days.includes(day)} onCheckedChange={checked => form.setValue(`schedules.${site.id}.days`, checked ? [...item.days, day] : item.days.filter(value => value !== day), { shouldDirty: true, shouldValidate: true })} />{label}</label>)}
          </div><FieldError>{issues?.days?.message}</FieldError></Field>
          <div className="saas-grid">{(["start", "end"] as const).map(key => <Field key={key} data-invalid={Boolean(issues?.[key])}>
            <FieldLabel htmlFor={`schedule-${site.id}-${key}`}>{key === "start" ? "Inicio" : "Fin"}</FieldLabel>
            <Input id={`schedule-${site.id}-${key}`} type="time" {...form.register(`schedules.${site.id}.${key}`)} aria-invalid={Boolean(issues?.[key])} />
            <FieldError>{issues?.[key]?.message}</FieldError>
          </Field>)}</div>
        </fieldset>
      })}
    </div>,
    professional: <div className="saas-stack">
      <div className="saas-grid">{text("profession", "Profesión")}{text("registration", "Registro profesional")}</div>
      <Field data-invalid={Boolean(errors.specialtyIds)}><FieldLabel>Especialidades asignadas *</FieldLabel>
        <div className="saas-checks">{data.specialties.filter(item => item.organizationId === organizationId && (item.active || values.specialtyIds.includes(item.id))).map(item => <label className="saas-check" key={item.id}>
          <Checkbox checked={values.specialtyIds.includes(item.id)} disabled={!item.active} onCheckedChange={checked => form.setValue("specialtyIds", checked ? [...values.specialtyIds, item.id] : values.specialtyIds.filter(id => id !== item.id), { shouldDirty: true, shouldValidate: true })} />{item.name}{!item.active && " (inactiva · asociación conservada)"}
        </label>)}</div><FieldError>{errors.specialtyIds?.message}</FieldError>
      </Field>
      <div className="saas-inline"><span>Estado profesional</span><ProfessionalStatusBadge state={user ? effectiveProfessionalState(user) : "ACTIVE"} /></div>
      {user?.professionalId && <p className="saas-hint">Gestiona el estado, las vacaciones y los permisos desde el directorio de profesionales.</p>}
    </div>,
    activation: <div className="saas-stack">
      <SaasSelect label="Método de activación" value={values.activation} items={activationLabels} onChange={value => form.setValue("activation", value as Values["activation"], { shouldDirty: true })} />
      <dl className="saas-summary">{[["Persona", nameOf(values)], ["Usuario", values.username], ["Correo", values.email], ["Rol", roleLabels[values.role]], ["Sedes", sites.filter(site => values.siteIds.includes(site.id)).map(site => site.name).join(", ")]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Por completar"}</dd></div>)}</dl>
      <p className="saas-hint">No se generan contraseñas ni se envían invitaciones reales.</p>
    </div>,
  }
  function close() { if (!form.formState.isSubmitting && (!form.formState.isDirty || confirm("¿Descartar los cambios del usuario?"))) onClose() }
  return <Dialog open onOpenChange={open => !open && close()}>
    <DialogContent variant="wide" className="saas-scope">
      <DialogHeader><DialogTitle>{user && data.users.some(item => item.id === user.id) ? "Editar usuario" : "Nuevo usuario"}</DialogTitle><DialogDescription>Datos personales, rol, sedes y acceso a la clínica.</DialogDescription></DialogHeader>
      <DialogBody ref={body}><form id="saas-user-form" noValidate onSubmit={event => { void form.handleSubmit(save, invalid => { const first = visibleGroups.flatMap(group => group.fields).find(key => key in invalid); if (first) reveal(first) })(event) }}>
        <fieldset disabled={form.formState.isSubmitting}>{visibleGroups.map(group => <section className="saas-accordion" key={group.id} data-modal-section={group.id}>
          <button type="button" data-modal-section-trigger onClick={() => accordion.request(accordion.open === group.id ? null : group.id)} aria-expanded={accordion.open === group.id} aria-controls={`staff-panel-${group.id}`}>
            <span className="saas-section-label">{(() => { const Icon = ({ personal: UserRound, credentials: KeyRound, assignments: Building2, professional: Stethoscope, activation: ShieldCheck })[group.id]; return Icon && <Icon aria-hidden="true" /> })()}{group.title}</span>{group.fields.some(field => field in errors) && <span className="text-destructive">Revisar</span>}<ChevronDown className="size-4" />
          </button>
          <div id={`staff-panel-${group.id}`} className="saas-accordion-motion" data-open={accordion.open === group.id} data-validation-panel inert={accordion.open !== group.id} aria-hidden={accordion.open !== group.id || undefined}>
            <div><div className="saas-accordion-body">{contents[group.id as keyof typeof contents]}</div></div>
          </div>
        </section>)}</fieldset>
        {failure && <p role="alert" className="text-destructive">{failure}</p>}
      </form></DialogBody>
      <DialogFooter><Button variant="outline" disabled={form.formState.isSubmitting} onClick={close}>Cancelar</Button><Button type="submit" form="saas-user-form" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Guardando…" : "Guardar usuario"}</Button></DialogFooter>
    </DialogContent>
    {creatingSite && profile && <InstitutionBranches branches={sites} editorOnly onEditorClose={() => setCreatingSite(false)} onCommit={async branches => { await saveInstitution.mutateAsync({ ...profile, branches }) }} />}
  </Dialog>
}
