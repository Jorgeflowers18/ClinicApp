import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { getErrorMessage } from "@/shared/lib/error-message"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"
import { ProfessionalStatusBadge } from "@/shared/components/administrative-status-badge"

import { useSaveProfessional } from "../api/appointments.queries"
import { professionalSchema, type Professional, type ProfessionalFormValues } from "../types/appointment.types"
import { ScheduleFormDialog } from "./schedule-form-dialog"

interface ProfessionalFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` para crear uno nuevo. */
  professional: Professional | null
}

const empty: ProfessionalFormValues = { name: "", specialty: "", registrationNumber: "", active: true }

/** Avisa al desactivar a un profesional que todavía tiene citas por atender. */
function futureAppointmentsWarning(count: number) {
  return count === 1
    ? "Tiene 1 cita futura: reprográmala o cancélala en la agenda."
    : `Tiene ${count} citas futuras: reprográmalas o cancélalas en la agenda.`
}

export function ProfessionalFormDialog({ open, onOpenChange, professional }: ProfessionalFormDialogProps) {
  const save = useSaveProfessional()
  const { register, control, handleSubmit, reset, getValues, setError, formState: { errors, isSubmitting, isDirty } } =
    useForm<ProfessionalFormValues>({ resolver: zodResolver(professionalSchema), defaultValues: empty })

  useEffect(() => {
    if (!open) return
    reset(professional
      ? { name: professional.name, specialty: professional.specialty, registrationNumber: professional.registrationNumber, active: professional.active }
      : empty)
  }, [open, professional, reset])

  async function onSubmit(values: ProfessionalFormValues) {
    try {
      // Se conserva el usuario vinculado: se cambia desde la pestaña Usuarios.
      const saved = await save.mutateAsync({ id: professional?.id, values, userId: professional?.userId ?? null })
      const deactivated = professional?.active && !values.active
      const future = saved.futureAppointments ?? 0
      if (deactivated && future > 0) toast.warning(`Profesional desactivado. ${futureAppointmentsWarning(future)}`, { duration: 10_000 })
      else toast.success(professional ? "Profesional actualizado" : "Profesional creado")
      onOpenChange(false)
    } catch (error) {
      if (!applyServerFieldErrors({ getValues, setError }, error).length) toast.error(getErrorMessage(error))
    }
  }

  return (
    <ScheduleFormDialog open={open} onOpenChange={onOpenChange} dirty={isDirty} busy={isSubmitting} className="clinic-catalog-dialog"
      title={professional ? "Editar profesional" : "Nuevo profesional"}
      description="Los profesionales activos se pueden elegir al agendar citas, al registrar atenciones y en los ciclos de esterilización.">
      {requestClose => <form onSubmit={handleSubmit(onSubmit)} className="clinic-schedule-form" noValidate>
        <FieldGroup className="clinic-schedule-fields">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="professionalName">Nombre</FieldLabel>
            <Input id="professionalName" placeholder="Dra. Carla Ríos" aria-invalid={!!errors.name} {...register("name")} />
            <FieldError errors={errors.name ? [errors.name] : undefined} />
          </Field>
          <Field data-invalid={!!errors.specialty}>
            <FieldLabel htmlFor="professionalSpecialty">Especialidad</FieldLabel>
            <Input id="professionalSpecialty" placeholder="Odontología general" aria-invalid={!!errors.specialty} {...register("specialty")} />
            <FieldError errors={errors.specialty ? [errors.specialty] : undefined} />
          </Field>
          <Field data-invalid={!!errors.registrationNumber}>
            <FieldLabel htmlFor="professionalRegistration">Registro profesional (opcional)</FieldLabel>
            <Input id="professionalRegistration" placeholder="MSP / Senescyt" aria-invalid={!!errors.registrationNumber} aria-describedby="professionalRegistrationHint" {...register("registrationNumber")} />
            <FieldDescription id="professionalRegistrationHint">Se imprime en la declaración de la historia clínica.</FieldDescription>
            <FieldError errors={errors.registrationNumber ? [errors.registrationNumber] : undefined} />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="professionalActive" className="flex-1">Profesional activo
              <FieldDescription id="professionalActiveHint">Si lo desactivas, ya no se ofrece al agendar; sus citas y atenciones siguen mostrando su nombre.</FieldDescription>
            </FieldLabel>
            <Controller control={control} name="active" render={({ field }) => <span className="inline-flex items-center gap-2">
              <ProfessionalStatusBadge state={field.value ? "ACTIVE" : "INACTIVE"} />
              <Switch id="professionalActive" aria-describedby="professionalActiveHint" checked={field.value} onCheckedChange={field.onChange} />
            </span>} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : professional ? "Guardar cambios" : "Crear profesional"}</Button>
        </DialogFooter>
      </form>}
    </ScheduleFormDialog>
  )
}
