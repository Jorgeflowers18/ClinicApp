import { useEffect, useRef, useState } from "react"
import { Download, FileText, Link2, Trash2, Upload } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { formatDateOnly, formatDateTime } from "@/shared/lib/date"
import { env } from "@/shared/lib/env"
import { getErrorMessage } from "@/shared/lib/error-message"

import { fetchAttachmentFile, useAttachmentFile, useUploadAttachment } from "../api/clinical-history.queries"
import { downloadBlob } from "../lib/dental-export"
import {
  allowedAttachmentTypes,
  attachmentKindLabels,
  attachmentKinds,
  examRequestStatusLabels,
  today,
  type AttachmentKind,
  type DentalAttachment,
  type ExamRequest,
  type RecordFormValues,
} from "../types/clinical-history.types"
import { examKindLabels } from "../types/encounter-assessment.types"

const kindItems = Object.fromEntries(attachmentKinds.map((kind) => [kind, attachmentKindLabels[kind]]))
const shortDate = (value: string) => formatDateOnly(value, { day: "2-digit", month: "short", year: "numeric" })

/** Muestra un `Blob` de imagen. El object URL se crea y se revoca junto con el elemento, sin estado de React. */
function BlobImage({ blob, alt }: { blob: Blob; alt: string }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(blob)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return <img ref={image} alt={alt} className="size-full object-contain" />
}

function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener")
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function AttachmentCard({
  patientId,
  file,
  canRemove,
  onRemove,
}: {
  patientId: string
  file: DentalAttachment
  canRemove: boolean
  onRemove: () => void
}) {
  const isImage = file.mime.startsWith("image/")
  const { data: blob } = useAttachmentFile(patientId, file, isImage)

  async function download() {
    try {
      downloadBlob(await fetchAttachmentFile(patientId, file), file.name)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <article className="overflow-hidden rounded-lg border">
      <div className="flex h-40 items-center justify-center bg-muted/40">
        {blob ? (
          <button type="button" className="size-full cursor-zoom-in" aria-label={`Abrir ${file.name}`} onClick={() => openBlob(blob)}>
            <BlobImage blob={blob} alt={file.name} />
          </button>
        ) : (
          <FileText className="size-8 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="break-all text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {attachmentKindLabels[file.kind]} · {(file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
          {formatDateTime(file.createdAt, { day: "2-digit", month: "short", year: "numeric" })}
        </p>
        <div className="flex justify-between gap-2">
          <Button size="sm" variant="outline" onClick={() => void download()}>
            <Download />
            Descargar
          </Button>
          {canRemove && (
            <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${file.name}`} onClick={onRemove}>
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

/**
 * Exámenes solicitados en las atenciones («requerimientos de consulta»). El resultado se sube a la
 * historia con el tipo del examen y el examen pasa a «Recibido»; se guarda con «Guardar cambios».
 */
function ExamRequestsCard({ patientId, onOpenEncounter }: { patientId: string; onOpenEncounter: (encounterId: string) => void }) {
  const { control, getValues, setValue } = useFormContext<RecordFormValues>()
  const [requests, attachments] = useWatch({ control, name: ["examRequests", "attachments"] })
  const upload = useUploadAttachment()
  const [target, setTarget] = useState<ExamRequest | null>(null)
  const input = useRef<HTMLInputElement>(null)
  // Pendientes primero; dentro de cada grupo, los más recientes primero.
  const sorted = [...requests].sort(
    (a, b) => Number(a.status === "recibido") - Number(b.status === "recibido") || b.requestedAt.localeCompare(a.requestedAt)
  )

  function chooseFile(request: ExamRequest) {
    setTarget(request)
    input.current?.click()
  }

  async function attachResult(files: FileList | null) {
    const file = files?.[0]
    if (!file || !target) return
    try {
      const attachment = await upload.mutateAsync({ patientId, file, kind: target.kind })
      setValue("attachments", [...getValues("attachments"), attachment], { shouldDirty: true })
      setValue(
        "examRequests",
        getValues("examRequests").map((item) =>
          item.id === target.id ? { ...item, status: "recibido", attachmentId: attachment.id, receivedAt: today() } : item
        ),
        { shouldDirty: true }
      )
      toast.success("Resultado adjuntado. Guarda los cambios para registrarlo.")
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
    setTarget(null)
    if (input.current) input.current.value = ""
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exámenes solicitados</CardTitle>
        <CardDescription>
          Exámenes e interconsultas pedidos en las atenciones. Al subir el resultado, el documento queda en la historia
          y el examen pasa a «Recibido».
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay exámenes solicitados.</p>
        ) : (
          <ul aria-label="Exámenes solicitados" className="divide-y rounded-lg border">
            {sorted.map((request) => {
              const result = attachments.find((file) => file.id === request.attachmentId)
              const label = examKindLabels[request.kind]
              return (
                <li key={request.id} aria-label={label} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-medium">
                      {label}
                      {request.detail && <span className="font-normal text-muted-foreground"> · {request.detail}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Solicitado el {shortDate(request.requestedAt)}
                      {request.receivedAt && ` · Recibido el ${shortDate(request.receivedAt)}`}
                      {result && ` · ${result.name}`}
                    </p>
                  </div>
                  <Badge variant={request.status === "recibido" ? "secondary" : "outline"}>
                    {examRequestStatusLabels[request.status]}
                  </Badge>
                  {request.encounterId && (
                    <Button size="sm" variant="ghost" onClick={() => onOpenEncounter(request.encounterId)}>
                      <Link2 />
                      Ver atención
                    </Button>
                  )}
                  {request.status === "pendiente" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={upload.isPending}
                      aria-label={`Subir resultado de ${label}`}
                      onClick={() => chooseFile(request)}
                    >
                      <Upload />
                      {upload.isPending && target?.id === request.id ? "Subiendo..." : "Subir resultado"}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <input
          ref={input}
          aria-label="Seleccionar resultado del examen"
          type="file"
          className="sr-only"
          accept={allowedAttachmentTypes.join(",")}
          onChange={(event) => void attachResult(event.target.files)}
        />
      </CardContent>
    </Card>
  )
}

interface AttachmentsTabProps {
  patientId: string
  /** Lleva a la atención que solicitó un examen. */
  onOpenEncounter: (encounterId: string) => void
}

export function AttachmentsTab({ patientId, onOpenEncounter }: AttachmentsTabProps) {
  const { control, getValues, setValue } = useFormContext<RecordFormValues>()
  const attachments = useWatch({ control, name: "attachments" })
  const upload = useUploadAttachment()
  const [kind, setKind] = useState<AttachmentKind>("fotografias")
  const [toRemove, setToRemove] = useState<DentalAttachment | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function attach(files: FileList | null) {
    if (!files?.length) return
    for (const file of Array.from(files)) {
      try {
        const attachment = await upload.mutateAsync({ patientId, file, kind })
        setValue("attachments", [...getValues("attachments"), attachment], { shouldDirty: true })
      } catch (error) {
        toast.error(getErrorMessage(error))
      }
    }
    if (input.current) input.current.value = ""
  }

  function confirmRemove() {
    if (!toRemove) return
    setValue(
      "attachments",
      getValues("attachments").filter((item) => item.id !== toRemove.id),
      { shouldDirty: true }
    )
    // Si era el documento firmado del consentimiento de datos, el consentimiento deja de apuntarlo.
    if (getValues("dataConsent.attachmentId") === toRemove.id) {
      setValue("dataConsent.attachmentId", null, { shouldDirty: true })
    }
    // Si era el resultado de un examen solicitado, el examen vuelve a quedar pendiente.
    if (getValues("examRequests").some((item) => item.attachmentId === toRemove.id)) {
      setValue(
        "examRequests",
        getValues("examRequests").map((item) =>
          item.attachmentId === toRemove.id ? { ...item, status: "pendiente", attachmentId: null, receivedAt: null } : item
        ),
        { shouldDirty: true }
      )
    }
    setToRemove(null)
  }

  return (
    <div className="space-y-4">
      <ExamRequestsCard patientId={patientId} onOpenEncounter={onOpenEncounter} />

      <Card>
        <CardHeader>
          <CardTitle>Fotos, radiografías y documentos</CardTitle>
          <CardDescription>
            Exámenes complementarios y documentos de la historia. JPG, PNG, WebP o PDF de hasta 20 MB por archivo.
            {/* MOCK-ONLY */}
            {env.useMockApi && " En modo demostración los originales se guardan en este navegador."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-64">
              <FieldLabel htmlFor="attachment-kind">Tipo de archivo clínico</FieldLabel>
              <Select items={kindItems} value={kind} onValueChange={(value) => value && setKind(value)}>
                <SelectTrigger id="attachment-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {attachmentKinds.map((item) => (
                    <SelectItem key={item} value={item}>
                      {attachmentKindLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
              <Upload />
              {upload.isPending ? "Subiendo archivos..." : "Adjuntar archivos"}
            </Button>
            <input
              ref={input}
              aria-label="Seleccionar archivos clínicos"
              type="file"
              className="sr-only"
              multiple
              accept={allowedAttachmentTypes.join(",")}
              onChange={(event) => void attach(event.target.files)}
            />
          </div>

          {attachments.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              Todavía no hay archivos en la historia del paciente.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {attachments.map((file) => (
                <AttachmentCard
                  key={file.id}
                  patientId={patientId}
                  file={file}
                  canRemove={!upload.isPending}
                  onRemove={() => setToRemove(file)}
                />
              ))}
            </div>
          )}
        </CardContent>

        <ConfirmDialog
          open={Boolean(toRemove)}
          onOpenChange={(open) => !open && setToRemove(null)}
          title="Quitar archivo"
          description={`¿Quitar «${toRemove?.name ?? ""}» de la historia? El archivo se elimina al guardar los cambios.`}
          confirmLabel="Quitar"
          destructive
          onConfirm={confirmRemove}
        />
      </Card>
    </div>
  )
}
