import { Controller, useFormContext, useWatch } from "react-hook-form"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { truthDeclarationText } from "../types/background.types"
import { dataConsentSignerLabels, dataConsentSigners, type RecordFormValues } from "../types/clinical-history.types"
import { CheckboxItem, TextField } from "./form-controls"

const NO_PROFESSIONAL = "__none__"
const signerItems = Object.fromEntries(dataConsentSigners.map((signer) => [signer, dataConsentSignerLabels[signer]]))

/** Declaración de veracidad del paciente (formulario en papel, sección 17). */
export function TruthDeclarationCard() {
  const { control } = useFormContext<RecordFormValues>()
  const [accepted, professionalId] = useWatch({
    control,
    name: ["truthDeclaration.accepted", "truthDeclaration.professionalId"],
  })
  const { data: professionals } = useProfessionals()
  const professional = professionals?.find((item) => item.id === professionalId)
  const professionalItems: Record<string, string> = {
    [NO_PROFESSIONAL]: "Sin asignar",
    ...Object.fromEntries((professionals ?? []).map((item) => [item.id, item.name])),
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Declaración de veracidad del paciente
          <Badge variant={accepted ? "secondary" : "outline"}>{accepted ? "Aceptada" : "Pendiente"}</Badge>
        </CardTitle>
        <CardDescription>Se registra una vez y se guarda con «Guardar cambios».</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <blockquote className="rounded-lg border-l-4 bg-muted/40 px-4 py-3 text-sm italic">{truthDeclarationText}</blockquote>

          <Controller
            control={control}
            name="truthDeclaration.accepted"
            render={({ field }) => (
              <CheckboxItem
                label={<span className="font-medium">El paciente acepta la declaración</span>}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />

          <div className="grid gap-4 md:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="declaration-signer">Quien declara</FieldLabel>
              <Controller
                control={control}
                name="truthDeclaration.signer"
                render={({ field }) => (
                  <Select items={signerItems} value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                    <SelectTrigger id="declaration-signer" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dataConsentSigners.map((item) => (
                        <SelectItem key={item} value={item}>
                          {dataConsentSignerLabels[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <TextField name="truthDeclaration.signerName" label="Paciente / representante" />
            <TextField name="truthDeclaration.signerDocumentId" label="C.I." />
            <TextField name="truthDeclaration.date" label="Fecha de la declaración" type="date" />
          </div>
          {!accepted && (
            <FieldDescription>Al marcar la aceptación se piden el nombre, la C.I. y la fecha (no futura).</FieldDescription>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="declaration-professional">Profesional tratante</FieldLabel>
              <Controller
                control={control}
                name="truthDeclaration.professionalId"
                render={({ field }) => (
                  <Select
                    items={professionalItems}
                    value={field.value || NO_PROFESSIONAL}
                    onValueChange={(value) => field.onChange(!value || value === NO_PROFESSIONAL ? "" : value)}
                  >
                    <SelectTrigger id="declaration-professional" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(professionalItems).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <div className="space-y-1">
              <p className="text-sm font-medium">Registro profesional</p>
              <p className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-sm" aria-label="Registro profesional">
                {professional ? professional.registrationNumber || "Sin registro" : "—"}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Firmas del paciente y del profesional: pendiente de definir (la forma de firmar se definirá a futuro).
          </p>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
