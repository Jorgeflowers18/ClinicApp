import { Controller, useFormContext } from "react-hook-form"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { NO_APPOINTMENT, usePatientAppointmentOptions } from "../hooks/use-patient-appointment-options"
import type { ClinicalEncounter, EncounterFormValues } from "../types/clinical-history.types"

interface ConsultationTabProps {
  patientId: string
  /** Atenciones ya registradas: sus citas no se ofrecen de nuevo. */
  encounters: ClinicalEncounter[]
}

const textFields = [
  { name: "reason", label: "Motivo de consulta", rows: 3, placeholder: "Síntomas y motivo referido por el paciente" },
  { name: "diagnosis", label: "Diagnóstico", rows: 3, placeholder: "Diagnóstico clínico de la atención" },
  { name: "procedures", label: "Procedimientos realizados", rows: 3, placeholder: "Procedimientos ejecutados en esta atención" },
  { name: "evolution", label: "Evolución / indicaciones", rows: 4, placeholder: "Evolución respecto a la atención anterior e indicaciones" },
  { name: "notes", label: "Observaciones", rows: 3, placeholder: "Observaciones internas del profesional" },
] as const

/** Campos clínicos de una atención nueva (formulario «Registrar atención»). */
export function ConsultationTab({ patientId, encounters }: ConsultationTabProps) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<EncounterFormValues>()
  const { data: professionals } = useProfessionals()
  const { options } = usePatientAppointmentOptions(patientId, encounters)

  const professionalItems: Record<string, string> = Object.fromEntries(
    (professionals ?? []).map((item) => [item.id, item.name])
  )
  const appointmentItems: Record<string, string> = {
    [NO_APPOINTMENT]: "Sin cita vinculada",
    ...Object.fromEntries(options.map((option) => [option.appointment.id, option.label])),
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución y diagnóstico</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 md:grid-cols-3">
            <Field data-invalid={!!errors.date}>
              <FieldLabel htmlFor="encounter-date">Fecha de la atención</FieldLabel>
              <Input id="encounter-date" type="date" aria-invalid={!!errors.date} {...register("date")} />
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

            <Field data-invalid={!!errors.appointmentId}>
              <FieldLabel htmlFor="encounter-appointment">Cita vinculada</FieldLabel>
              <Controller
                control={control}
                name="appointmentId"
                render={({ field }) => (
                  <Select
                    items={appointmentItems}
                    value={field.value ?? NO_APPOINTMENT}
                    onValueChange={(value) => field.onChange(!value || value === NO_APPOINTMENT ? null : value)}
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
              <FieldError errors={errors.appointmentId ? [errors.appointmentId] : undefined} />
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

          <Field data-invalid={!!errors.nextVisit} className="md:max-w-xs">
            <FieldLabel htmlFor="encounter-nextVisit">Próximo control</FieldLabel>
            <Input id="encounter-nextVisit" type="date" aria-invalid={!!errors.nextVisit} {...register("nextVisit")} />
            <FieldError errors={errors.nextVisit ? [errors.nextVisit] : undefined} />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
