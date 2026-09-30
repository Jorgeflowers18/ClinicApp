import { useEffect, useRef, useState } from "react"
import { Download, FileText, Trash2, Upload } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { formatDateTime } from "@/shared/lib/date"
import { env } from "@/shared/lib/env"
import { getErrorMessage } from "@/shared/lib/error-message"

import { fetchAttachmentFile, useAttachmentFile, useUploadAttachment } from "../api/clinical-history.queries"
import { downloadBlob } from "../lib/dental-export"
import {
  allowedAttachmentTypes,
  attachmentKindLabels,
  attachmentKinds,
  type AttachmentKind,
  type DentalAttachment,
  type VisitFormValues,
} from "../types/clinical-history.types"

const kindItems = Object.fromEntries(attachmentKinds.map((kind) => [kind, attachmentKindLabels[kind]]))

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

export function AttachmentsTab({ patientId, readOnly }: { patientId: string; readOnly: boolean }) {
  const { control, getValues, setValue } = useFormContext<VisitFormValues>()
  const attachments = useWatch({ control, name: "attachments" })
  const upload = useUploadAttachment()
  const [kind, setKind] = useState<AttachmentKind>("fotografia")
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
    setToRemove(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fotos, radiografías y documentos</CardTitle>
        <CardDescription>
          JPG, PNG, WebP o PDF de hasta 20 MB por archivo.
          {/* MOCK-ONLY */}
          {env.useMockApi && " En modo demostración los originales se guardan en este navegador."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-52">
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
        )}

        {attachments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Todavía no hay archivos asociados a esta visita.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {attachments.map((file) => (
              <AttachmentCard
                key={file.id}
                patientId={patientId}
                file={file}
                canRemove={!readOnly && !upload.isPending}
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
        description={`¿Quitar «${toRemove?.name ?? ""}» de esta visita? El archivo se elimina al guardar el borrador.`}
        confirmLabel="Quitar"
        destructive
        onConfirm={confirmRemove}
      />
    </Card>
  )
}
