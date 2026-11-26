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
import { AdministrativeStatusBadge } from "@/shared/components/administrative-status-badge"

import { useSaveRoom } from "../api/appointments.queries"
import { roomSchema, type Room, type RoomFormValues } from "../types/appointment.types"
import { ScheduleFormDialog } from "./schedule-form-dialog"

interface RoomFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` para crear uno nuevo. */
  room: Room | null
}

const empty: RoomFormValues = { name: "", active: true }

export function RoomFormDialog({ open, onOpenChange, room }: RoomFormDialogProps) {
  const save = useSaveRoom()
  const { register, control, handleSubmit, reset, getValues, setError, formState: { errors, isSubmitting, isDirty } } =
    useForm<RoomFormValues>({ resolver: zodResolver(roomSchema), defaultValues: empty })

  useEffect(() => {
    if (open) reset(room ? { name: room.name, active: room.active } : empty)
  }, [open, room, reset])

  async function onSubmit(values: RoomFormValues) {
    try {
      await save.mutateAsync({ id: room?.id, values })
      toast.success(room ? "Consultorio actualizado" : "Consultorio creado")
      onOpenChange(false)
    } catch (error) {
      // Un nombre repetido entre los activos llega como 409 con errors.name: queda en el campo.
      if (!applyServerFieldErrors({ getValues, setError }, error).length) toast.error(getErrorMessage(error))
    }
  }

  return (
    <ScheduleFormDialog open={open} onOpenChange={onOpenChange} dirty={isDirty} busy={isSubmitting} className="clinic-catalog-dialog"
      title={room ? "Editar consultorio" : "Nuevo consultorio"}
      description="Los consultorios activos se pueden elegir al agendar citas y al bloquear horarios.">
      {requestClose => <form onSubmit={handleSubmit(onSubmit)} className="clinic-schedule-form" noValidate>
        <FieldGroup className="clinic-schedule-fields">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="roomName">Nombre</FieldLabel>
            <Input id="roomName" placeholder="Consultorio 1" aria-invalid={!!errors.name} {...register("name")} />
            <FieldError errors={errors.name ? [errors.name] : undefined} />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="roomActive" className="flex-1">Consultorio activo
              <FieldDescription id="roomActiveHint">Si lo desactivas, ya no se ofrece al agendar; sus citas siguen mostrando su nombre.</FieldDescription>
            </FieldLabel>
            <Controller control={control} name="active" render={({ field }) => <span className="inline-flex items-center gap-2">
              <AdministrativeStatusBadge kind="room" state={field.value ? "active" : "inactive"} />
              <Switch id="roomActive" aria-describedby="roomActiveHint" checked={field.value} onCheckedChange={field.onChange} />
            </span>} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : room ? "Guardar cambios" : "Crear consultorio"}</Button>
        </DialogFooter>
      </form>}
    </ScheduleFormDialog>
  )
}
