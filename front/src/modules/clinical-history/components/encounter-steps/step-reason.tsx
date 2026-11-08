import { Controller, useFormContext } from "react-hook-form"

import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import type { AppointmentOption } from "../../hooks/use-patient-appointment-options"
import { NO_APPOINTMENT } from "../../hooks/use-patient-appointment-options"
import { today } from "../../lib/record"
import type { EncounterFormValues } from "../../types/clinical-history.types"

interface StepReasonProps {
  /** Citas vinculables (ya filtradas: sin atención y de hoy o antes). */
  appointmentOptions: AppointmentOption[]
}

const textFields = [
  { name: "reason", label: "Motivo de consulta", rows: 3, placeholder: "Síntomas y motivo referido por el paciente" },
  {
    name: "presentIllness",
    label: "Enfermedad actual",
    rows: 4,
    placeholder: "Inicio, evolución, intensidad, factores desencadenantes y tratamientos previos",
  },
] as const

/** Paso 1: cita, fecha, profesional, motivo de consulta y enfermedad actual. */
export function StepReason({ appointmentOptions }: StepReasonProps) {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<EncounterFormValues>()
  const { data: professionals } = useProfessionals()

  const professionalItems: Record<string, string> = Object.fromEntries(
    (professionals ?? []).map((item) => [item.id, item.name])
  )
  const appointmentItems: Record<string, string> = {
    [NO_APPOINTMENT]: "Sin cita vinculada",
    ...Object.fromEntries(appointmentOptions.map((option) => [option.appointment.id, option.label])),
  }

  /** Elegir una cita precarga su fecha y su profesional. */
  function handleAppointmentChange(value: string | null, onChange: (value: string | null) => void) {
    const id = !value || value === NO_APPOINTMENT ? null : value
    onChange(id)
    const option = appointmentOptions.find((item) => item.appointment.id === id)
    if (!option) return
    setValue("date", option.date, { shouldValidate: true })
    setValue("professionalId", option.appointment.professionalId, { shouldValidate: true })
  }

  return (
    <FieldGroup>
      <div className="grid gap-4 md:grid-cols-3">
        <Field data-invalid={!!errors.appointmentId}>
          <FieldLabel htmlFor="encounter-appointment">Cita</FieldLabel>
          <Controller
            control={control}
            name="appointmentId"
            render={({ field }) => (
              <Select
                items={appointmentItems}
                value={field.value ?? NO_APPOINTMENT}
                onValueChange={(value) => handleAppointmentChange(value, field.onChange)}
              >
                <SelectTrigger id="encounter-appointment" className="w-full" aria-invalid={!!errors.appointmentId}>
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
          <FieldDescription>Al guardar, la cita pasa a «Completada».</FieldDescription>
          <FieldError errors={errors.appointmentId ? [errors.appointmentId] : undefined} />
        </Field>

        <Field data-invalid={!!errors.date}>
          <FieldLabel htmlFor="encounter-date">Fecha de la atención</FieldLabel>
          <Input id="encounter-date" type="date" max={today()} aria-invalid={!!errors.date} {...register("date")} />
          <FieldError errors={errors.date ? [errors.date] : undefined} />
        </Field>

        <Field data-invalid={!!errors.professionalId}>
          <FieldLabel htmlFor="encounter-professional">Profesional</FieldLabel>
          <Controller
            control={control}
            name="professionalId"
            render={({ field }) => (
              <Select
                items={professionalItems}
                value={field.value || null}
                onValueChange={(value) => field.onChange(value ?? "")}
              >
                <SelectTrigger id="encounter-professional" className="w-full" aria-invalid={!!errors.professionalId}>
                  <SelectValue placeholder="Selecciona un profesional..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(professionalItems).map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={errors.professionalId ? [errors.professionalId] : undefined} />
        </Field>
      </div>

      {textFields.map(({ name, label, rows, placeholder }) => (
        <Field key={name} data-invalid={!!errors[name]}>
          <FieldLabel htmlFor={`encounter-${name}`}>{label}</FieldLabel>
          <Textarea
            id={`encounter-${name}`}
            rows={rows}
            placeholder={placeholder}
            aria-invalid={!!errors[name]}
            {...register(name)}
          />
          <FieldError errors={errors[name] ? [errors[name]] : undefined} />
        </Field>
      ))}

    </FieldGroup>
  )
}
