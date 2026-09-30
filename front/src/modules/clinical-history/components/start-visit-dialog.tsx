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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { useStartVisit } from "../api/clinical-history.queries"
import { useDefaultProfessionalId } from "../hooks/use-default-professional"
import { NO_APPOINTMENT, usePatientAppointmentOptions } from "../hooks/use-patient-appointment-options"
import { today } from "../lib/visit"
import { startVisitSchema, type DentalRecord, type DentalVisit, type StartVisitInput } from "../types/clinical-history.types"

interface StartVisitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  record: DentalRecord
  /** Cita con la que se abrió la historia (`?cita=`); se preselecciona si sigue disponible. */
  appointmentId?: string | null
  onStarted: (visit: DentalVisit) => void
}

export function StartVisitDialog({ open, onOpenChange, patientId, record, appointmentId, onStarted }: StartVisitDialogProps) {
  const { data: professionals } = useProfessionals()
  const defaultProfessionalId = useDefaultProfessionalId()
  const { options } = usePatientAppointmentOptions(patientId, record)
  const startVisit = useStartVisit(patientId)
  const hasPrevious = record.visits.some((visit) => visit.status === "cerrada")

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<StartVisitInput>({
    resolver: zodResolver(startVisitSchema),
    defaultValues: { professionalId: "", appointmentId: null, date: today() },
  })

  // Al abrir se parte de la cita preseleccionada o del profesional del usuario logueado.
  useEffect(() => {
    if (!open) return
    reset({ professionalId: "", appointmentId: null, date: today() })
  }, [open, reset])

  // Las citas y los profesionales llegan de forma asíncrona: se completan solo si el usuario no eligió nada.
  useEffect(() => {
    if (!open) return
    const preselected = options.find((option) => option.appointment.id === appointmentId)
    if (preselected && !getValues("appointmentId")) {
      setValue("appointmentId", preselected.appointment.id)
      setValue("professionalId", preselected.appointment.professionalId)
      setValue("date", preselected.date)
      return
    }
    if (!getValues("professionalId") && defaultProfessionalId) setValue("professionalId", defaultProfessionalId)
  }, [open, options, appointmentId, defaultProfessionalId, getValues, setValue])

  function handleAppointmentChange(value: string | null, onChange: (value: string | null) => void) {
    const id = !value || value === NO_APPOINTMENT ? null : value
    onChange(id)
    const option = options.find((item) => item.appointment.id === id)
    if (!option) return
    setValue("date", option.date, { shouldValidate: true })
    setValue("professionalId", option.appointment.professionalId, { shouldValidate: true })
  }

  async function onSubmit(values: StartVisitInput) {
    try {
      const visit = await startVisit.mutateAsync(values)
      toast.success("Visita iniciada. Los cambios se guardan automáticamente como borrador.")
      onOpenChange(false)
      onStarted(visit)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const professionalItems = Object.fromEntries((professionals ?? []).map((item) => [item.id, item.name]))
  const appointmentItems: Record<string, string> = {
    [NO_APPOINTMENT]: "Sin cita vinculada",
    ...Object.fromEntries(options.map((option) => [option.appointment.id, option.label])),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva visita</DialogTitle>
          <DialogDescription>
            {hasPrevious
              ? "La visita parte del odontograma de la última visita cerrada y arrastra los tratamientos propuestos pendientes."
              : "Primera visita del paciente: el odontograma comienza en blanco."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field data-invalid={!!errors.appointmentId}>
              <FieldLabel htmlFor="start-appointment">Cita</FieldLabel>
              <Controller
                control={control}
                name="appointmentId"
                render={({ field }) => (
                  <Select
                    items={appointmentItems}
                    value={field.value ?? NO_APPOINTMENT}
                    onValueChange={(value) => handleAppointmentChange(value, field.onChange)}
                  >
                    <SelectTrigger id="start-appointment" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(appointmentItems).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription>Al cerrar la visita, la cita vinculada pasa a «Completada».</FieldDescription>
              <FieldError errors={errors.appointmentId ? [errors.appointmentId] : undefined} />
            </Field>

            <Field data-invalid={!!errors.professionalId}>
              <FieldLabel htmlFor="start-professional">Profesional</FieldLabel>
              <Controller
                control={control}
                name="professionalId"
                render={({ field }) => (
                  <Select items={professionalItems} value={field.value || null} onValueChange={(value) => field.onChange(value ?? "")}>
                    <SelectTrigger id="start-professional" className="w-full" aria-invalid={!!errors.professionalId}>
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

            <Field data-invalid={!!errors.date}>
              <FieldLabel htmlFor="start-date">Fecha de la visita</FieldLabel>
              <Input id="start-date" type="date" aria-invalid={!!errors.date} {...register("date")} />
              <FieldError errors={errors.date ? [errors.date] : undefined} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Iniciando..." : "Iniciar visita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
