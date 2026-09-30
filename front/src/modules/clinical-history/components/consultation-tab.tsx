import { Controller, useFormContext } from "react-hook-form"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { NO_APPOINTMENT, usePatientAppointmentOptions } from "../hooks/use-patient-appointment-options"
import type { DentalRecord, DentalVisit, VisitFormValues } from "../types/clinical-history.types"

interface ConsultationTabProps {
  visit: DentalVisit
  record: DentalRecord
  readOnly: boolean
}

const textFields = [
  { name: "reason", label: "Motivo de consulta", rows: 3, placeholder: "Síntomas y motivo referido por el paciente" },
  { name: "diagnosis", label: "Diagnóstico", rows: 3, placeholder: "Diagnóstico clínico de la visita" },
  { name: "procedures", label: "Procedimientos realizados", rows: 3, placeholder: "Procedimientos ejecutados en esta visita" },
  { name: "evolution", label: "Evolución por visita", rows: 4, placeholder: "Evolución respecto a la visita anterior" },
  { name: "notes", label: "Notas profesionales", rows: 3, placeholder: "Observaciones internas del profesional" },
] as const

export function ConsultationTab({ visit, record, readOnly }: ConsultationTabProps) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<VisitFormValues>()
  const { data: professionals } = useProfessionals()
  const { options } = usePatientAppointmentOptions(visit.patientId, record, visit.id)

  const professionalItems: Record<string, string> = Object.fromEntries(
    (professionals ?? []).map((item) => [item.id, item.name])
  )
  if (visit.professionalId && !professionalItems[visit.professionalId]) {
    professionalItems[visit.professionalId] = visit.legacyProfessionalName ?? "Profesional no disponible"
  }
  const appointmentItems: Record<string, string> = {
    [NO_APPOINTMENT]: "Sin cita vinculada",
    ...Object.fromEntries(options.map((option) => [option.appointment.id, option.label])),
  }
  if (visit.appointmentId && !appointmentItems[visit.appointmentId]) {
    appointmentItems[visit.appointmentId] = "Cita vinculada (no disponible en la agenda)"
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
              <FieldLabel htmlFor="visit-date">Fecha de consulta</FieldLabel>
              <Input id="visit-date" type="date" readOnly={readOnly} aria-invalid={!!errors.date} {...register("date")} />
              <FieldError errors={errors.date ? [errors.date] : undefined} />
            </Field>

            <Field data-invalid={!!errors.professionalId}>
              <FieldLabel htmlFor="visit-professional">Profesional</FieldLabel>
              <Controller
                control={control}
                name="professionalId"
                render={({ field }) => (
                  <Select
                    items={professionalItems}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                    disabled={readOnly}
                  >
                    <SelectTrigger id="visit-professional" className="w-full" aria-invalid={!!errors.professionalId}>
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
              {!visit.professionalId && visit.legacyProfessionalName && (
                <FieldDescription>Registrado originalmente como «{visit.legacyProfessionalName}».</FieldDescription>
              )}
              <FieldError errors={errors.professionalId ? [errors.professionalId] : undefined} />
            </Field>

            <Field data-invalid={!!errors.appointmentId}>
              <FieldLabel htmlFor="visit-appointment">Cita vinculada</FieldLabel>
              <Controller
                control={control}
                name="appointmentId"
                render={({ field }) => (
                  <Select
                    items={appointmentItems}
                    value={field.value ?? NO_APPOINTMENT}
                    onValueChange={(value) => field.onChange(!value || value === NO_APPOINTMENT ? null : value)}
                    disabled={readOnly}
                  >
                    <SelectTrigger id="visit-appointment" className="w-full" aria-invalid={!!errors.appointmentId}>
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
              <FieldLabel htmlFor={`visit-${name}`}>{label}</FieldLabel>
              <Textarea
                id={`visit-${name}`}
                rows={rows}
                placeholder={readOnly ? undefined : placeholder}
                readOnly={readOnly}
                aria-invalid={!!errors[name]}
                {...register(name)}
              />
              <FieldError errors={errors[name] ? [errors[name]] : undefined} />
            </Field>
          ))}

          <Field data-invalid={!!errors.nextVisit} className="md:max-w-xs">
            <FieldLabel htmlFor="visit-nextVisit">Próximo control</FieldLabel>
            <Input id="visit-nextVisit" type="date" readOnly={readOnly} aria-invalid={!!errors.nextVisit} {...register("nextVisit")} />
            <FieldError errors={errors.nextVisit ? [errors.nextVisit] : undefined} />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
