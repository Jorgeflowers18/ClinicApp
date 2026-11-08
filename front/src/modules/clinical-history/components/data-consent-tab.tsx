import { useRef } from "react"
import { Download, Upload, X } from "lucide-react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getErrorMessage } from "@/shared/lib/error-message"

import { fetchAttachmentFile, useUploadAttachment } from "../api/clinical-history.queries"
import { downloadBlob } from "../lib/dental-export"
import {
  allowedAttachmentTypes,
  dataConsentSignerLabels,
  dataConsentSigners,
  dataConsentStatusLabels,
  dataConsentStatuses,
  dataConsentText,
  type RecordFormValues,
} from "../types/clinical-history.types"

const statusItems = Object.fromEntries(dataConsentStatuses.map((status) => [status, dataConsentStatusLabels[status]]))
const signerItems = Object.fromEntries(dataConsentSigners.map((signer) => [signer, dataConsentSignerLabels[signer]]))

/** Consentimiento de almacenamiento y tratamiento de datos personales y clínicos (uno por paciente). */
export function DataConsentTab({ patientId }: { patientId: string }) {
  const {
    control,
    register,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<RecordFormValues>()
  const [status, attachmentId, attachments] = useWatch({
    control,
    name: ["dataConsent.status", "dataConsent.attachmentId", "attachments"],
  })
  const upload = useUploadAttachment()
  const input = useRef<HTMLInputElement>(null)
  const consentErrors = errors.dataConsent
  const signedDocument = attachments.find((file) => file.id === attachmentId)
  const decided = status !== "pendiente"

  async function attach(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    try {
      const attachment = await upload.mutateAsync({ patientId, file, kind: "consentimiento" })
      setValue("attachments", [...getValues("attachments"), attachment], { shouldDirty: true })
      setValue("dataConsent.attachmentId", attachment.id, { shouldDirty: true })
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
    if (input.current) input.current.value = ""
  }

  async function download() {
    if (!signedDocument) return
    try {
      downloadBlob(await fetchAttachmentFile(patientId, signedDocument), signedDocument.name)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Consentimiento de datos
          <Badge variant={status === "aceptado" ? "secondary" : "outline"}>{dataConsentStatusLabels[status]}</Badge>
        </CardTitle>
        <CardDescription>
          Autorización del paciente para almacenar y tratar sus datos personales y clínicos. Se registra una vez y se
          guarda con «Guardar cambios».
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Alert>
            <AlertTitle>Texto del consentimiento (provisional)</AlertTitle>
            <AlertDescription>
              <p>{dataConsentText}</p>
              <p className="text-xs">El texto legal definitivo lo debe proveer la clínica.</p>
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <Field data-invalid={!!consentErrors?.status}>
              <FieldLabel htmlFor="consent-status">Estado</FieldLabel>
              <Controller
                control={control}
                name="dataConsent.status"
                render={({ field }) => (
                  <Select items={statusItems} value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                    <SelectTrigger id="consent-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dataConsentStatuses.map((item) => (
                        <SelectItem key={item} value={item}>
                          {dataConsentStatusLabels[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="consent-signer">Firma</FieldLabel>
              <Controller
                control={control}
                name="dataConsent.signer"
                render={({ field }) => (
                  <Select items={signerItems} value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                    <SelectTrigger id="consent-signer" className="w-full">
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
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field data-invalid={!!consentErrors?.signerName}>
              <FieldLabel htmlFor="consent-signer-name">Nombre de quien firma</FieldLabel>
              <Input id="consent-signer-name" aria-invalid={!!consentErrors?.signerName} {...register("dataConsent.signerName")} />
              <FieldError errors={consentErrors?.signerName ? [consentErrors.signerName] : undefined} />
            </Field>

            <Field data-invalid={!!consentErrors?.signerDocumentId}>
              <FieldLabel htmlFor="consent-signer-document">Cédula de quien firma</FieldLabel>
              <Input
                id="consent-signer-document"
                aria-invalid={!!consentErrors?.signerDocumentId}
                {...register("dataConsent.signerDocumentId")}
              />
              <FieldError errors={consentErrors?.signerDocumentId ? [consentErrors.signerDocumentId] : undefined} />
            </Field>

            <Field data-invalid={!!consentErrors?.date}>
              <FieldLabel htmlFor="consent-date">Fecha de la decisión</FieldLabel>
              <Input id="consent-date" type="date" aria-invalid={!!consentErrors?.date} {...register("dataConsent.date")} />
              <FieldError errors={consentErrors?.date ? [consentErrors.date] : undefined} />
            </Field>
          </div>
          {!decided && (
            <FieldDescription>
              Mientras esté pendiente, el nombre, la cédula y la fecha son opcionales. Se piden al marcarlo como aceptado
              o rechazado.
            </FieldDescription>
          )}

          <Field>
            <FieldLabel>Documento firmado (opcional)</FieldLabel>
            {signedDocument ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                <span className="min-w-0 flex-1 break-all font-medium">{signedDocument.name}</span>
                <Button size="sm" variant="outline" onClick={() => void download()}>
                  <Download />
                  Descargar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setValue("dataConsent.attachmentId", null, { shouldDirty: true })}
                >
                  <X />
                  Desvincular
                </Button>
              </div>
            ) : (
              <div>
                <Button variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
                  <Upload />
                  {upload.isPending ? "Subiendo documento..." : "Adjuntar documento firmado"}
                </Button>
                <input
                  ref={input}
                  aria-label="Seleccionar documento firmado"
                  type="file"
                  className="sr-only"
                  accept={allowedAttachmentTypes.join(",")}
                  onChange={(event) => void attach(event.target.files)}
                />
              </div>
            )}
            <FieldDescription>
              El documento también queda en «Fotos y documentos». Desvincularlo no lo elimina de ahí.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
