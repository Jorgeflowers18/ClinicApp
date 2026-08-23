import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatientsList } from "@/modules/patients/api/patients.queries"
import { useActiveTreatments } from "@/modules/treatments/api/treatments.queries"

import { useCreateAppointment, useProfessionals, useUpdateAppointment } from "../api/appointments.queries"
import { appointmentSchema, type AppointmentFormValues } from "../types/appointment.types"
import type { Appointment } from "../types/appointment.types"

interface AppointmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment?: Appointment
  initialSlot?: { date: string; startTime: string; endTime: string }
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  appointment,
  initialSlot,
}: AppointmentFormDialogProps) {
  const isEditMode = Boolean(appointment)
  const { data: patientsPage } = usePatientsList({ page: 1, pageSize: 100 })
  const { data: professionals } = useProfessionals()
  const { data: treatments } = useActiveTreatments()

  const createAppointment = useCreateAppointment()
  const updateAppointment = useUpdateAppointment(appointment?.id ?? "")

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: "",
      professionalId: "",
      treatmentId: "",
      date: "",
      startTime: "",
      endTime: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (!open) return

    if (appointment) {
      const start = new Date(appointment.start)
      const end = new Date(appointment.end)
      reset({
        patientId: appointment.patientId,
        professionalId: appointment.professionalId,
        treatmentId: appointment.treatmentId ?? "",
        date: toDateInputValue(start),
        startTime: toTimeInputValue(start),
        endTime: toTimeInputValue(end),
        notes: appointment.notes ?? "",
      })
    } else {
      reset({
        patientId: "",
        professionalId: "",
        treatmentId: "",
        date: initialSlot?.date ?? "",
        startTime: initialSlot?.startTime ?? "",
        endTime: initialSlot?.endTime ?? "",
        notes: "",
      })
    }
  }, [open, appointment, initialSlot, reset])

  async function onSubmit(values: AppointmentFormValues) {
    try {
      if (isEditMode && appointment) {
        await updateAppointment.mutateAsync(values)
        toast.success("Cita actualizada")
      } else {
        await createAppointment.mutateAsync(values)
        toast.success("Cita creada")
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar cita" : "Nueva cita"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Modifica los datos de la cita. Se valida disponibilidad del profesional."
              : "Agenda una nueva cita. Se valida disponibilidad del profesional."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field data-invalid={!!errors.patientId}>
              <FieldLabel htmlFor="patientId">Paciente</FieldLabel>
              <Controller
                control={control}
                name="patientId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="patientId" className="w-full">
                      <SelectValue placeholder="Selecciona un paciente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {patientsPage?.items.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.patientId ? [errors.patientId] : undefined} />
            </Field>

            <Field data-invalid={!!errors.professionalId}>
              <FieldLabel htmlFor="professionalId">Profesional</FieldLabel>
              <Controller
                control={control}
                name="professionalId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="professionalId" className="w-full">
                      <SelectValue placeholder="Selecciona un profesional..." />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals?.map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>
                          {professional.name} · {professional.specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.professionalId ? [errors.professionalId] : undefined} />
            </Field>

            <Field>
              <FieldLabel htmlFor="treatmentId">Tratamiento (opcional)</FieldLabel>
              <Controller
                control={control}
                name="treatmentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="treatmentId" className="w-full">
                      <SelectValue placeholder="Selecciona un tratamiento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {treatments?.map((treatment) => (
                        <SelectItem key={treatment.id} value={treatment.id}>
                          {treatment.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
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

            <Field>
              <FieldLabel htmlFor="notes">Notas</FieldLabel>
              <Textarea id="notes" rows={2} {...register("notes")} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : isEditMode ? "Guardar cambios" : "Agendar cita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toTimeInputValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}
