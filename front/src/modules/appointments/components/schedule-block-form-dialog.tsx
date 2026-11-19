import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage } from "@/shared/lib/error-message"

import { useCreateScheduleBlock, useProfessionals, useRooms } from "../api/appointments.queries"
import { scheduleBlockSchema, type ScheduleBlockFormValues } from "../types/appointment.types"
import { ScheduleFormDialog } from "./schedule-form-dialog"

interface ScheduleBlockFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSlot?: { date: string; startTime: string; endTime: string }
}

export function ScheduleBlockFormDialog({ open, onOpenChange, initialSlot }: ScheduleBlockFormDialogProps) {
  const { data: professionals } = useProfessionals()
  const { data: rooms } = useRooms()
  const createScheduleBlock = useCreateScheduleBlock()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ScheduleBlockFormValues>({
    resolver: zodResolver(scheduleBlockSchema),
    defaultValues: {
      professionalId: "",
      roomId: "",
      date: "",
      startTime: "",
      endTime: "",
      reason: "",
    },
  })

  useEffect(() => {
    if (!open) return
    reset({
      professionalId: "",
      roomId: "",
      date: initialSlot?.date ?? "",
      startTime: initialSlot?.startTime ?? "",
      endTime: initialSlot?.endTime ?? "",
      reason: "",
    })
  }, [open, initialSlot, reset])

  async function onSubmit(values: ScheduleBlockFormValues) {
    try {
      await createScheduleBlock.mutateAsync(values)
      toast.success("Bloqueo de horario creado")
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <ScheduleFormDialog open={open} onOpenChange={onOpenChange} dirty={isDirty}
      busy={isSubmitting || createScheduleBlock.isPending} title="Bloquear horario"
      description="Bloquea un rango de tiempo puntual para un profesional y/o un consultorio (vacaciones, almuerzo, mantenimiento, etc.). No se podrán agendar citas en ese horario.">
      {requestClose => <form onSubmit={handleSubmit(onSubmit)} className="clinic-schedule-form">
          <FieldGroup className="clinic-schedule-fields">
            <Field>
              <FieldLabel htmlFor="professionalId">Profesional (opcional)</FieldLabel>
              <Controller
                control={control}
                name="professionalId"
                render={({ field }) => (
                  <Select items={Object.fromEntries((professionals ?? []).map(item => [item.id, item.name]))} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="professionalId" className="w-full">
                      <SelectValue placeholder="Selecciona un profesional..." />
                    </SelectTrigger>
                    <SelectContent className="clinic-schedule-options">
                      {professionals?.map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>
                          {professional.name} · {professional.specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field data-invalid={!!errors.roomId}>
              <FieldLabel htmlFor="roomId">Consultorio (opcional)</FieldLabel>
              <Controller
                control={control}
                name="roomId"
                render={({ field }) => (
                  <Select items={Object.fromEntries((rooms ?? []).map(item => [item.id, item.name]))} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="roomId" className="w-full" aria-invalid={!!errors.roomId}>
                      <SelectValue placeholder="Selecciona un consultorio..." />
                    </SelectTrigger>
                    <SelectContent className="clinic-schedule-options">
                      {rooms?.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.roomId ? [errors.roomId] : undefined} />
            </Field>

            <div className="clinic-schedule-times clinic-schedule-wide">
              <Field data-invalid={!!errors.date}>
                <FieldLabel htmlFor="date">Fecha</FieldLabel>
                <Input id="date" type="date" aria-invalid={!!errors.date} {...register("date")} />
                <FieldError errors={errors.date ? [errors.date] : undefined} />
              </Field>

              <Field data-invalid={!!errors.startTime}>
                <FieldLabel htmlFor="startTime">Inicio</FieldLabel>
                <Input id="startTime" type="time" aria-invalid={!!errors.startTime} {...register("startTime")} />
                <FieldError errors={errors.startTime ? [errors.startTime] : undefined} />
              </Field>

              <Field data-invalid={!!errors.endTime}>
                <FieldLabel htmlFor="endTime">Fin</FieldLabel>
                <Input id="endTime" type="time" aria-invalid={!!errors.endTime} {...register("endTime")} />
                <FieldError errors={errors.endTime ? [errors.endTime] : undefined} />
              </Field>
            </div>

            <Field className="clinic-schedule-wide" data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="reason">Motivo</FieldLabel>
              <Textarea
                id="reason"
                rows={2}
                placeholder="Vacaciones, almuerzo, mantenimiento..."
                aria-invalid={!!errors.reason}
                {...register("reason")}
              />
              <FieldError errors={errors.reason ? [errors.reason] : undefined} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Bloquear horario"}
            </Button>
          </DialogFooter>
        </form>}
    </ScheduleFormDialog>
  )
}
