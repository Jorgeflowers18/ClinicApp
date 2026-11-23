import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getErrorMessage } from "@/shared/lib/error-message"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { ScheduleFormDialog } from "@/modules/appointments/components/schedule-form-dialog"

import { useCreatePasswordLink, useCreateUser, useUpdateUser } from "../api/users.queries"
import { useAuthStore } from "../store/auth-store"
import { roles } from "../types/auth.types"
import { roleLabels, userSchema, type ManagedUser, type PasswordLink, type UserFormValues } from "../types/user-admin.types"

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` para crear una cuenta nueva. */
  user: ManagedUser | null
  /** Al crear la cuenta o generar un enlace nuevo: el enlace para que la persona elija su contraseña. */
  onPasswordLink: (value: { name: string; link: PasswordLink }) => void
}

const NONE = "none"
const empty: UserFormValues = { name: "", email: "", role: "recepcion", professionalId: "", active: true }

export function UserFormDialog({ open, onOpenChange, user, onPasswordLink }: UserFormDialogProps) {
  const currentUserId = useAuthStore((state) => state.user?.id)
  const isSelf = Boolean(user && user.id === currentUserId)
  const { data: professionals = [] } = useProfessionals()
  const create = useCreateUser(), update = useUpdateUser(), passwordLink = useCreatePasswordLink()
  const { register, control, handleSubmit, reset, getValues, setError, formState: { errors, isSubmitting, isDirty } } =
    useForm<UserFormValues>({ resolver: zodResolver(userSchema), defaultValues: empty })

  useEffect(() => {
    if (!open) return
    reset(user
      ? { name: user.name, email: user.email, role: user.role, professionalId: user.professionalId ?? "", active: user.active }
      : empty)
  }, [open, user, reset])

  // Profesionales activos sin otra cuenta, más el que ya tiene vinculado (aunque esté inactivo).
  const options = professionals.filter((item) =>
    item.id === user?.professionalId || (item.active && (!item.userId || item.userId === user?.id)))
  const items = { [NONE]: "Sin profesional", ...Object.fromEntries(options.map((item) => [item.id, item.name])) }

  async function onSubmit(values: UserFormValues) {
    try {
      if (user) {
        await update.mutateAsync({ id: user.id, values })
        toast.success("Cuenta actualizada")
        onOpenChange(false)
      } else {
        const created = await create.mutateAsync(values)
        toast.success("Cuenta creada")
        onOpenChange(false)
        onPasswordLink({ name: created.user.name, link: created.passwordLink })
      }
    } catch (error) {
      if (!applyServerFieldErrors({ getValues, setError }, error).length) toast.error(getErrorMessage(error))
    }
  }

  function newPasswordLink() {
    if (!user || passwordLink.isPending) return
    passwordLink.mutate(user.id, {
      onSuccess: (link) => { onOpenChange(false); onPasswordLink({ name: user.name, link }) },
      onError: (error) => toast.error(getErrorMessage(error)),
    })
  }

  return (
    <ScheduleFormDialog open={open} onOpenChange={onOpenChange} dirty={isDirty} busy={isSubmitting || passwordLink.isPending} className="clinic-catalog-dialog"
      title={user ? "Editar cuenta" : "Nueva cuenta"}
      description={user ? "El rol define qué módulos ve. Si le cambias el rol o la desactivas, se cierran sus sesiones." : "La persona elige su contraseña con un enlace que se muestra al crear la cuenta."}>
      {requestClose => <form onSubmit={handleSubmit(onSubmit)} className="clinic-schedule-form" noValidate>
        <FieldGroup className="clinic-schedule-fields">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="userName">Nombre</FieldLabel>
            <Input id="userName" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
            <FieldError errors={errors.name ? [errors.name] : undefined} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="userEmail">Correo</FieldLabel>
            <Input id="userEmail" type="email" autoComplete="off" aria-invalid={!!errors.email} {...register("email")} />
            <FieldError errors={errors.email ? [errors.email] : undefined} />
          </Field>
          <Field data-invalid={!!errors.role}>
            <FieldLabel htmlFor="userRole">Rol</FieldLabel>
            <Controller control={control} name="role" render={({ field }) =>
              <Select items={roleLabels} value={field.value} disabled={isSelf} onValueChange={(value) => field.onChange(value ?? "recepcion")}>
                <SelectTrigger id="userRole" className="w-full" aria-invalid={!!errors.role} aria-describedby={isSelf ? "userActiveHint" : undefined}><SelectValue /></SelectTrigger>
                <SelectContent className="clinic-schedule-options">{roles.map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}</SelectContent>
              </Select>} />
            <FieldError errors={errors.role ? [errors.role] : undefined} />
          </Field>
          <Field data-invalid={!!errors.professionalId}>
            <FieldLabel htmlFor="userProfessional">Profesional vinculado (opcional)</FieldLabel>
            <Controller control={control} name="professionalId" render={({ field }) =>
              <Select items={items} value={field.value || NONE} onValueChange={(value) => field.onChange(!value || value === NONE ? "" : value)}>
                <SelectTrigger id="userProfessional" className="w-full" aria-invalid={!!errors.professionalId} aria-describedby="userProfessionalHint"><SelectValue /></SelectTrigger>
                <SelectContent className="clinic-schedule-options">
                  <SelectItem value={NONE}>Sin profesional</SelectItem>
                  {options.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.specialty}</SelectItem>)}
                </SelectContent>
              </Select>} />
            <FieldDescription id="userProfessionalHint">Es el profesional que se propone al registrar sus atenciones.</FieldDescription>
            <FieldError errors={errors.professionalId ? [errors.professionalId] : undefined} />
          </Field>
          {user && <Field orientation="horizontal" data-invalid={!!errors.active}>
            <FieldLabel htmlFor="userActive" className="flex-1">Cuenta activa
              <FieldDescription id="userActiveHint">{isSelf ? "No puedes desactivar tu propia cuenta ni quitarte el rol de administrador." : "Una cuenta desactivada no puede iniciar sesión."}</FieldDescription>
            </FieldLabel>
            <Controller control={control} name="active" render={({ field }) =>
              <Switch id="userActive" aria-describedby="userActiveHint" disabled={isSelf} checked={field.value} onCheckedChange={field.onChange} />} />
            <FieldError errors={errors.active ? [errors.active] : undefined} />
          </Field>}
          {user?.active && !isSelf && <div className="grid gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Contraseña</p>
            <p className="text-sm text-muted-foreground">Genera un enlace para que elija una contraseña nueva (por ejemplo, si la olvidó). El enlace anterior deja de valer.{isDirty ? " Guarda o descarta los cambios primero." : ""}</p>
            <Button type="button" variant="outline" className="justify-self-start" disabled={passwordLink.isPending || isSubmitting || isDirty} onClick={newPasswordLink}>
              <KeyRound aria-hidden="true" />{passwordLink.isPending ? "Generando…" : "Generar enlace de contraseña"}
            </Button>
          </div>}
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : user ? "Guardar cambios" : "Crear cuenta"}</Button>
        </DialogFooter>
      </form>}
    </ScheduleFormDialog>
  )
}
