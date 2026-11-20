import { ClinicalFileManager } from "../archive/components/clinical-file-manager"
import { useRef, useState } from "react"
import { Link2, Upload } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"

import { useUploadAttachment } from "../api/clinical-history.queries"
import {
  allowedAttachmentTypes,
  examRequestStatusLabels,
  today,
  type ExamRequest,
  type RecordFormValues,
} from "../types/clinical-history.types"
import { examKindLabels } from "../types/encounter-assessment.types"

const shortDate = (value: string) => formatDateOnly(value, { day: "2-digit", month: "short", year: "numeric" })

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

export function AttachmentsTab({ patientId, onOpenEncounter }: { patientId: string; onOpenEncounter: (id: string) => void }) {
  return <div className="space-y-4"><ExamRequestsCard patientId={patientId} onOpenEncounter={onOpenEncounter} /><ClinicalFileManager patientId={patientId} /></div>
}
