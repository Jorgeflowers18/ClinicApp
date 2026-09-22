import { useEffect, useRef, useState } from "react"
import { Download, FileText, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { readFile, storeFile } from "./repository"
import { attachmentLabels, type AttachmentKind, type DentalAttachment, type DentalVisit } from "./types"
import { downloadBlob } from "./export"
import { selectClass } from "./clinical-panels"

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"])
const maxSize = 20 * 1024 * 1024

function AttachmentCard({ file, patientId, readOnly, remove }: {
  file: DentalAttachment; patientId: string; readOnly: boolean; remove: () => void
}) {
  const [preview, setPreview] = useState("")
  useEffect(() => {
    if (!file.mime.startsWith("image/")) return
    let cancelled = false
    let url = ""
    readFile(patientId, file.id).then((blob) => {
      if (cancelled) return
      url = URL.createObjectURL(blob)
      setPreview(url)
    }).catch(() => undefined)
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [file.id, file.mime, patientId])
  const download = async () => {
    try { downloadBlob(await readFile(patientId, file.id), file.name) }
    catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo descargar el archivo") }
  }
  return <article className="overflow-hidden rounded-lg border">
    <div className="flex h-40 items-center justify-center bg-muted/40">
      {preview ? <a href={preview} target="_blank" rel="noreferrer" className="h-full w-full" aria-label={`Abrir ${file.name}`}><img src={preview} alt={file.name} className="h-full w-full object-contain" /></a> : <FileText className="size-8 text-muted-foreground" />}
    </div>
    <div className="space-y-2 p-3">
      <p className="break-all text-sm font-medium">{file.name}</p>
      <p className="text-xs text-muted-foreground">{attachmentLabels[file.kind]} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>
      <div className="flex justify-between gap-2"><Button size="sm" variant="outline" onClick={download}><Download />Descargar</Button>{!readOnly && <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${file.name}`} onClick={remove}><Trash2 /></Button>}</div>
    </div>
  </article>
}

export function AttachmentsPanel({ patientId, visit, readOnly, update, onUploading }: {
  patientId: string; visit: DentalVisit; readOnly: boolean; update: (update: (draft: DentalVisit) => DentalVisit) => void
  onUploading: (value: boolean) => void
}) {
  const [kind, setKind] = useState<AttachmentKind>("fotografia")
  const [uploading, setUploading] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const attach = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    onUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (!allowedTypes.has(file.type) || file.size > maxSize) {
          toast.error(`${file.name}: utiliza JPG, PNG, WebP o PDF de hasta 20 MB.`)
          continue
        }
        const item: DentalAttachment = { id: crypto.randomUUID(), name: file.name, mime: file.type, kind, size: file.size, createdAt: new Date().toISOString() }
        await storeFile(patientId, item.id, file)
        update((draft) => ({ ...draft, attachments: [...draft.attachments, item] }))
      }
    } catch { toast.error("No se pudo guardar el archivo. Revisa el espacio del navegador.") }
    finally { setUploading(false); onUploading(false); if (input.current) input.current.value = "" }
  }
  return <Card><CardHeader><CardTitle>Fotos, radiografías y documentos</CardTitle></CardHeader><CardContent className="space-y-4">
    {!readOnly && <div className="flex flex-wrap items-end gap-3">
      <div className="w-52 space-y-2"><Label htmlFor="attachment-kind">Tipo de archivo clínico</Label><select id="attachment-kind" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value as AttachmentKind)}>{Object.entries(attachmentLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <Button variant="outline" disabled={uploading} onClick={() => input.current?.click()}><Upload />{uploading ? "Guardando archivos…" : "Adjuntar archivos"}</Button>
      <input ref={input} aria-label="Seleccionar archivos clínicos" type="file" className="sr-only" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => void attach(e.target.files)} />
    </div>}
    <p className="text-xs text-muted-foreground">JPG, PNG, WebP o PDF · Hasta 20 MB por archivo. Los originales se conservan en este navegador.</p>
    {!visit.attachments.length && <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Todavía no hay archivos asociados a esta visita.</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visit.attachments.map((file) => <AttachmentCard key={file.id} file={file} patientId={patientId} readOnly={readOnly || uploading} remove={() => {
      if (!window.confirm(`¿Eliminar ${file.name} del borrador de esta visita?`)) return
      // Only drafts can remove attachments; completed visits retain their files.
      update((draft) => ({ ...draft, attachments: draft.attachments.filter((item) => item.id !== file.id) }))
    }} />)}</div>
  </CardContent></Card>
}
