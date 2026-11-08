import { Controller, useFormContext, useWatch } from "react-hook-form"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { calculateAge, formatDateTime } from "@/shared/lib/date"
import { genderOptions, maritalStatusOptions, type Patient } from "@/modules/patients/types/patient.types"

import type { PatientDataValues } from "../lib/patient-data"
import type { ClinicalRecord } from "../types/clinical-history.types"
import { TextField } from "./form-controls"

const NO_MARITAL_STATUS = "__none__"
const genderItems = Object.fromEntries(genderOptions.map((option) => [option.value, option.label]))
const maritalItems: Record<string, string> = {
  [NO_MARITAL_STATUS]: "Sin registrar",
  ...Object.fromEntries(maritalStatusOptions.map((option) => [option.value, option.label])),
}

const longDate = (iso: string) => formatDateTime(iso, { day: "2-digit", month: "long", year: "numeric" })

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <p className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-sm">{value}</p>
    </div>
  )
}

interface PatientDataTabProps {
  patient: Patient
  record: ClinicalRecord
}

/**
 * «Datos del Cliente» del formulario en papel. Es el mismo registro del paciente: se guarda con
 * «Guardar cambios» de la historia y se ve en la ficha del paciente.
 */
export function PatientDataTab({ patient, record }: PatientDataTabProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<{ patient: PatientDataValues }>()
  const birthDate = useWatch({ control, name: "patient.birthDate" })
  const age = birthDate ? calculateAge(birthDate) : null
  const patientErrors = errors.patient

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Identificación del paciente</CardTitle>
          <CardDescription>
            Son los mismos datos de la ficha del paciente: lo que se cambie aquí también se ve en Pacientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <ReadOnlyValue label="N.° de historia clínica" value={patient.clinicalRecordNumber || "Sin asignar"} />
            <ReadOnlyValue label="Fecha de apertura" value={longDate(record.createdAt)} />
            <ReadOnlyValue label="Fecha de actualización" value={longDate(record.updatedAt)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField name="patient.lastName" label="Apellidos" />
            <TextField name="patient.firstName" label="Nombres" />
            <TextField name="patient.documentId" label="Cédula / pasaporte" />
            <TextField name="patient.birthDate" label="Fecha de nacimiento" type="date" />
            <ReadOnlyValue label="Edad" value={age !== null ? `${age} años` : "—"} />
            <Field data-invalid={!!patientErrors?.gender}>
              <FieldLabel htmlFor="patient-gender">Sexo / género</FieldLabel>
              <Controller
                control={control}
                name="patient.gender"
                render={({ field }) => (
                  <Select items={genderItems} value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                    <SelectTrigger id="patient-gender" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {genderOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={patientErrors?.gender ? [patientErrors.gender] : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="patient-marital-status">Estado civil</FieldLabel>
              <Controller
                control={control}
                name="patient.maritalStatus"
                render={({ field }) => (
                  <Select
                    items={maritalItems}
                    value={field.value || NO_MARITAL_STATUS}
                    onValueChange={(value) => field.onChange(!value || value === NO_MARITAL_STATUS ? "" : value)}
                  >
                    <SelectTrigger id="patient-marital-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(maritalItems).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <TextField name="patient.occupation" label="Ocupación" />
            <TextField name="patient.company" label="Empresa / institución" />
            <TextField name="patient.nationality" label="Nacionalidad" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField name="patient.address" label="Dirección domiciliaria" />
          <TextField name="patient.city" label="Ciudad / provincia" />
          <TextField name="patient.phone" label="Teléfono" />
          <TextField name="patient.email" label="Correo electrónico" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacto de emergencia</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <TextField name="patient.emergencyContactName" label="Contacto de emergencia" />
          <TextField name="patient.emergencyContactRelationship" label="Parentesco" />
          <TextField name="patient.emergencyContactPhone" label="Teléfono de emergencia" />
        </CardContent>
      </Card>
    </div>
  )
}
