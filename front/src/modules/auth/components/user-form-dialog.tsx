import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { KeyRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { getErrorMessage } from "@/shared/lib/error-message"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"
import { scrollToValidationTarget } from "@/shared/lib/validation-focus"
import { documentValidationMessage } from "@/shared/lib/ecuadorian-cedula"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { ScheduleFormDialog } from "@/modules/appointments/components/schedule-form-dialog"
import type { Professional } from "@/modules/appointments/types/appointment.types"
import { useSaasData } from "@/modules/saas/state"
import { readDemoData, assertUsernameAvailable } from "@/modules/saas/adapters/demo-repository"
import { useStaffInstitution } from "@/modules/saas/lib/institution-scope"
import { accessRoles, builtinRoleId } from "@/modules/saas/lib/access-catalogs"
import { catalogService } from "@/modules/saas/catalog-services"
import { RoleSelection } from "@/modules/saas/components/role-selection"
import { UsernameField, SaasSelect } from "@/modules/saas/components/controls"
import { usernameSchema } from "@/modules/saas/lib/identity"
import type { StaffSettings } from "@/modules/saas/types"
import { useCreatePasswordLink, useCreateUser, useUpdateUser } from "../api/users.queries"
import { useAuthStore } from "../store/auth-store"
import { roleLabels, userSchema, type ManagedUser, type PasswordLink, type UserFormValues } from "../types/user-admin.types"

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: ManagedUser | null
  prefillProfessional?: Professional
  onPasswordLink: (value: { name: string; link: PasswordLink }) => void
}
const NONE = "none"
const empty: UserFormValues = { name: "", email: "", role: "recepcion", professionalId: "", active: true }
const emptySettings: StaffSettings = { accessRoleIds: [], professionalTypeId: null, username: "", documentType: "otro", documentNumber: "", siteIds: [] }

export function UserFormDialog(props: UserFormDialogProps) {
  return <UserFormDialogState key={String(props.open) + (props.user?.id ?? props.prefillProfessional?.id ?? "new")} {...props} />
}
function UserFormDialogState({ open, onOpenChange, user, onPasswordLink, prefillProfessional }: UserFormDialogProps) {
  const data = useSaasData(), { organizationId, organization } = useStaffInstitution(), catalog = accessRoles(data, organizationId)
  const currentUserId = useAuthStore(state => state.user?.id), isSelf = Boolean(user && user.id === currentUserId)
  const { data: professionals = [] } = useProfessionals()
  const create = useCreateUser(), update = useUpdateUser(), passwordLink = useCreatePasswordLink()
  const [originalSettings] = useState<StaffSettings>(() => {
    const scope = readDemoData().serverStaffSettings?.[organizationId] ?? {}
    const saved = user ? scope[user.id] ?? (user.professionalId ? scope["professional:" + user.professionalId] : undefined) : scope["professional:" + prefillProfessional?.id]
    return { ...emptySettings, ...saved, username: saved?.username ?? data.identities.find(item => item.id === user?.id)?.username ?? "", accessRoleIds: saved?.accessRoleIds.length ? saved.accessRoleIds : [builtinRoleId(organizationId, user?.role ?? (prefillProfessional ? "medico" : "recepcion"))] }
  })
  const [settings, setSettings] = useState<StaffSettings>(originalSettings)
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({}), [failure, setFailure] = useState("")
  const createdRef = useRef<{ user: ManagedUser; passwordLink: PasswordLink } | null>(null)
  const { register, control, handleSubmit, reset, getValues, setError, setValue, formState: { errors, isSubmitting, isDirty } } =
    useForm<UserFormValues>({ resolver: zodResolver(userSchema), defaultValues: empty })
  useEffect(() => {
    if (!open) return
    createdRef.current = null
    reset(user ? { name: user.name, email: user.email, role: user.role, professionalId: user.professionalId ?? "", active: user.active }
      : prefillProfessional ? { ...empty, name: prefillProfessional.name, professionalId: prefillProfessional.id, role: "medico" } : empty)
  }, [open, user, reset, prefillProfessional, organizationId])
  const localDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings)
  const options = professionals.filter(item => item.id === user?.professionalId || item.active && (!item.userId || item.userId === user?.id))
  const items = { [NONE]: "Sin profesional", ...Object.fromEntries(options.map(item => [item.id, item.name])) }
  const linked = useWatch({ control, name: "professionalId" }), baseRole = useWatch({ control, name: "role" })
  async function onSubmit(values: UserFormValues) {
    const found: Record<string, string> = {}, doc = documentValidationMessage(settings.documentType ?? "otro", settings.documentNumber ?? "")
    if (doc) found.documentNumber = doc
    if (!settings.accessRoleIds.length) found.accessRoleIds = "Selecciona al menos un rol."
    if (isSelf && !catalog.some(role => role.builtin === "admin" && settings.accessRoleIds.includes(role.id))) found.accessRoleIds = "Tu cuenta debe conservar el rol Administrador."
    if (!user || settings.username) {
      const parsed = usernameSchema.safeParse(settings.username ?? "")
      if (!parsed.success) found.username = parsed.error.issues[0].message
      else try { assertUsernameAvailable(settings.username!, user?.id ?? createdRef.current?.user.id) } catch { found.username = "Este nombre de usuario ya está asignado." }
    }
    setLocalErrors(found)
    if (Object.keys(found).length) {
      const target = document.querySelector<HTMLElement>(found.username ? "#user-local-username input" : found.documentNumber ? "#user-documentNumber" : "#staff-accessRoleIds")
      if (target) scrollToValidationTarget(target)
      return
    }
    setFailure("")
    try {
      if (user) {
        await update.mutateAsync({ id: user.id, values })
        await catalogService.saveServerSettings(user.id, { ...settings, email: values.email }, values.professionalId)
        toast.success("Cuenta actualizada"); onOpenChange(false)
      } else {
        const created = createdRef.current ?? await create.mutateAsync(values)
        if (createdRef.current) await update.mutateAsync({ id: created.user.id, values })
        createdRef.current = created
        await catalogService.saveServerSettings(created.user.id, { ...settings, email: values.email }, values.professionalId)
        toast.success("Cuenta creada"); onOpenChange(false); onPasswordLink({ name: values.name, link: created.passwordLink })
      }
    } catch (error) { if (!applyServerFieldErrors({ getValues, setError }, error).length) { setFailure(getErrorMessage(error)); toast.error(getErrorMessage(error)) } }
  }
  function newPasswordLink() {
    if (!user || passwordLink.isPending) return
    passwordLink.mutate(user.id, { onSuccess: link => { onOpenChange(false); onPasswordLink({ name: user.name, link }) }, onError: error => toast.error(getErrorMessage(error)) })
  }
  return <ScheduleFormDialog open={open} onOpenChange={onOpenChange} dirty={isDirty || localDirty} busy={isSubmitting || passwordLink.isPending} className="clinic-catalog-dialog"
    title={user ? "Editar cuenta" : prefillProfessional ? "Crear acceso" : "Nueva cuenta"}
    description="Gestiona la cuenta y su vínculo profesional. Los roles adicionales y los datos extendidos se guardan en la configuración frontend.">
    {requestClose => <form onSubmit={handleSubmit(onSubmit)} className="clinic-schedule-form" noValidate><FieldGroup className="clinic-schedule-fields">
      <Field data-invalid={!!errors.name}><FieldLabel htmlFor="userName">Nombre</FieldLabel><Input id="userName" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} /><FieldError errors={errors.name ? [errors.name] : undefined} /></Field>
      <Field data-invalid={!!errors.email}><FieldLabel htmlFor="userEmail">Correo</FieldLabel><Input id="userEmail" type="email" autoComplete="off" aria-invalid={!!errors.email} {...register("email")} /><FieldError errors={errors.email ? [errors.email] : undefined} /></Field>
      <div id="user-local-username"><UsernameField value={settings.username ?? ""} onChange={username => setSettings(current => ({ ...current, username }))} accountId={user?.id} required={!user} error={localErrors.username} /></div>
      <SaasSelect label="Tipo de documento" value={settings.documentType ?? "otro"} items={{ cedula: "Cédula ecuatoriana", pasaporte: "Pasaporte", ruc: "RUC", extranjero: "Documento extranjero", otro: "Otro documento" }} onChange={documentType => { setSettings(current => ({ ...current, documentType })); setLocalErrors(current => ({ ...current, documentNumber: "" })) }} />
      <Field data-invalid={Boolean(localErrors.documentNumber)}><FieldLabel htmlFor="user-documentNumber">Número de documento</FieldLabel><Input id="user-documentNumber" value={settings.documentNumber ?? ""} aria-invalid={Boolean(localErrors.documentNumber)} onBlur={() => setLocalErrors(current => ({ ...current, documentNumber: documentValidationMessage(settings.documentType ?? "otro", settings.documentNumber ?? "") }))} onChange={event => {
        const documentNumber = event.target.value; setSettings(current => ({ ...current, documentNumber }))
        if (localErrors.documentNumber) setLocalErrors(current => ({ ...current, documentNumber: documentValidationMessage(settings.documentType ?? "otro", documentNumber) }))
      }} /><FieldError>{localErrors.documentNumber}</FieldError></Field>
      <RoleSelection roles={catalog} value={settings.accessRoleIds} error={localErrors.accessRoleIds ?? errors.role?.message} onChange={ids => {
        setSettings(current => ({ ...current, accessRoleIds: ids }))
        const selected = catalog.filter(role => ids.includes(role.id) && role.builtin)
        if (!selected.some(role => role.builtin === getValues("role")) && selected[0]?.builtin) setValue("role", selected[0].builtin, { shouldDirty: true })
      }} />
      <p className="saas-hint">Rol base de la cuenta: {roleLabels[baseRole]}. Los roles adicionales configuran la visibilidad del entorno frontend.</p>
      <Field data-invalid={!!errors.professionalId}><FieldLabel htmlFor="userProfessional">Profesional vinculado (opcional)</FieldLabel>
        <Controller control={control} name="professionalId" render={({ field }) => <Select items={items} value={field.value || NONE} onValueChange={value => field.onChange(!value || value === NONE ? "" : value)}>
          <SelectTrigger id="userProfessional" className="w-full" aria-invalid={!!errors.professionalId}><SelectValue /></SelectTrigger><SelectContent className="clinic-schedule-options"><SelectItem value={NONE}>Sin profesional</SelectItem>{options.map(item => <SelectItem key={item.id} value={item.id}>{item.name} · {item.specialty}</SelectItem>)}</SelectContent>
        </Select>} /><FieldDescription>Se conserva el identificador del profesional al crear su acceso.</FieldDescription><FieldError errors={errors.professionalId ? [errors.professionalId] : undefined} />
      </Field>
      {linked && <SaasSelect label="Tipo de profesional" value={settings.professionalTypeId || "none"} items={{ none: "Sin tipo asignado", ...Object.fromEntries((data.professionalTypes ?? []).filter(type => type.organizationId === organizationId && (type.active || type.id === settings.professionalTypeId)).map(type => [type.id, type.name + (!type.active ? " (inactivo)" : "")])) }} onChange={id => setSettings(current => ({ ...current, professionalTypeId: id === "none" ? null : id }))} />}
      <Field><FieldLabel>Sedes asignadas</FieldLabel>{!organization.branches.length && <p className="saas-hint">Todavía no hay sedes registradas.</p>}<div className="saas-checks">{organization.branches.map(site => <label key={site.id} className="saas-check"><Checkbox checked={settings.siteIds?.includes(site.id) ?? false} onCheckedChange={checked => setSettings(current => ({ ...current, siteIds: checked ? [...new Set([...(current.siteIds ?? []), site.id])] : current.siteIds?.filter(id => id !== site.id) }))} />{site.name}</label>)}</div></Field>
      {user && <Field orientation="horizontal" data-invalid={!!errors.active}><FieldLabel htmlFor="userActive" className="flex-1">Cuenta activa<FieldDescription id="userActiveHint">{isSelf ? "Tu cuenta debe conservar el acceso administrativo." : "Una cuenta desactivada no puede iniciar sesión."}</FieldDescription></FieldLabel><Controller control={control} name="active" render={({ field }) => <Switch id="userActive" aria-describedby="userActiveHint" disabled={isSelf} checked={field.value} onCheckedChange={field.onChange} />} /><FieldError errors={errors.active ? [errors.active] : undefined} /></Field>}
      {user?.active && !isSelf && <div className="grid gap-2 rounded-lg border p-3"><p className="text-sm font-medium">Contraseña</p><p className="text-sm text-muted-foreground">Genera un enlace para que la persona elija una contraseña nueva. Guarda o descarta primero los cambios.</p><Button type="button" variant="outline" className="justify-self-start" disabled={passwordLink.isPending || isSubmitting || isDirty || localDirty} onClick={newPasswordLink}><KeyRound />{passwordLink.isPending ? "Generando…" : "Generar enlace de contraseña"}</Button></div>}
      {failure && <p role="alert" className="text-destructive">{failure}</p>}
    </FieldGroup><DialogFooter><Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : user ? "Guardar cambios" : "Crear cuenta"}</Button></DialogFooter></form>}
  </ScheduleFormDialog>
}
