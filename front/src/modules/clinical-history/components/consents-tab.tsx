import { Plus, Trash2 } from "lucide-react"
import { Controller, useFieldArray, useFormContext } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { consentStatuses, consentStatusLabels, type VisitFormValues } from "../types/clinical-history.types"

const statusItems = Object.fromEntries(consentStatuses.map((status) => [status, consentStatusLabels[status]]))

export function ConsentsTab({ readOnly }: { readOnly: boolean }) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<VisitFormValues>()
  // `keyName` evita que el id técnico de React Hook Form pise el `id` propio del consentimiento.
  const { fields, append, remove } = useFieldArray({ control, name: "consents", keyName: "fieldKey" })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consentimientos informados</CardTitle>
        <CardDescription>
          Registra lo explicado al paciente. El documento firmado se adjunta en «Fotos y documentos».
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay consentimientos registrados en esta visita.
          </div>
        )}

        {fields.map((field, index) => {
          const itemErrors = errors.consents?.[index]
          const prefix = `consent-${index}`
          return (
            <article key={field.fieldKey} className="space-y-4 rounded-lg border p-4" aria-label={`Consentimiento ${index + 1}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">Consentimiento {index + 1}</h3>
                {!readOnly && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Eliminar consentimiento ${index + 1}`} onClick={() => remove(index)}>
                    <Trash2 />
                  </Button>
                )}
              </div>

              <Field data-invalid={!!itemErrors?.procedure}>
                <FieldLabel htmlFor={`${prefix}-procedure`}>Procedimiento autorizado</FieldLabel>
                <Input
                  id={`${prefix}-procedure`}
                  readOnly={readOnly}
                  aria-invalid={!!itemErrors?.procedure}
                  {...register(`consents.${index}.procedure`)}
                />
                <FieldError errors={itemErrors?.procedure ? [itemErrors.procedure] : undefined} />
              </Field>

              <Field data-invalid={!!itemErrors?.information}>
                <FieldLabel htmlFor={`${prefix}-information`}>Información, riesgos y alternativas explicados</FieldLabel>
                <Textarea
                  id={`${prefix}-information`}
                  rows={3}
                  readOnly={readOnly}
                  aria-invalid={!!itemErrors?.information}
                  {...register(`consents.${index}.information`)}
                />
                <FieldError errors={itemErrors?.information ? [itemErrors.information] : undefined} />
              </Field>

              <div className="grid gap-4 md:grid-cols-3">
                <Field data-invalid={!!itemErrors?.status}>
                  <FieldLabel htmlFor={`${prefix}-status`}>Estado del consentimiento</FieldLabel>
                  <Controller
                    control={control}
                    name={`consents.${index}.status`}
                    render={({ field: statusField }) => (
                      <Select
                        items={statusItems}
                        value={statusField.value}
                        onValueChange={(value) => value && statusField.onChange(value)}
                        disabled={readOnly}
                      >
                        <SelectTrigger id={`${prefix}-status`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {consentStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {consentStatusLabels[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field data-invalid={!!itemErrors?.signer}>
                  <FieldLabel htmlFor={`${prefix}-signer`}>Nombre del firmante</FieldLabel>
                  <Input
                    id={`${prefix}-signer`}
                    readOnly={readOnly}
                    aria-invalid={!!itemErrors?.signer}
                    {...register(`consents.${index}.signer`)}
                  />
                  <FieldError errors={itemErrors?.signer ? [itemErrors.signer] : undefined} />
                </Field>

                <Field data-invalid={!!itemErrors?.date}>
                  <FieldLabel htmlFor={`${prefix}-date`}>Fecha de firma / decisión</FieldLabel>
                  <Input
                    id={`${prefix}-date`}
                    type="date"
                    readOnly={readOnly}
                    aria-invalid={!!itemErrors?.date}
                    {...register(`consents.${index}.date`)}
                  />
                  <FieldError errors={itemErrors?.date ? [itemErrors.date] : undefined} />
                </Field>
              </div>
            </article>
          )
        })}

        {!readOnly && (
          <Button
            variant="outline"
            onClick={() =>
              append({ id: crypto.randomUUID(), procedure: "", information: "", status: "pendiente", signer: "", date: "" })
            }
          >
            <Plus />
            Agregar consentimiento
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
