import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight, Download, Maximize, Minimize, RotateCcw, RotateCw, Scan, ZoomIn, ZoomOut, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "@/components/ui/dialog"
import { formatDateOnly } from "@/shared/lib/date"
import type { DentalAttachment } from "../../types/clinical-history.types"
import { useBlobUrl, useOriginal } from "../hooks"
import { initialTransform, downloadOriginal, toggleFullscreen } from "../lib/viewer"
import { bytesLabel, fileCategory, fileName, fileTypeLabel, isClinicalImage } from "../lib/classification"
import { IconAction } from "./controls"
import { ImageSurface } from "./image-surface"
import type { MetadataOptions } from "./metadata-fields"
import styles from "../archive.module.css"

function PdfPreview({ patientId, file }: { patientId: string; file: DentalAttachment }) {
  const query = useOriginal(patientId, file), url = useBlobUrl(query.data)
  if (query.isPending) return <p role="status">Cargando documento original…</p>
  if (query.isError) return <div role="alert">No se pudo cargar el PDF.<Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div>
  return <div className={styles.pdf}>
    <p className={styles.hint}>Vista PDF del navegador. Si no se visualiza, utiliza Descargar original para abrirlo localmente.</p>
    {url && <object
      data={url}
      type="application/pdf"
      aria-label={`PDF: ${fileName(file)}`}
    >
      <p>La vista PDF no está disponible en este navegador. Descarga el original para consultarlo.</p>
    </object>}
  </div>
}
export function FileInformation({ file, options }: { file: DentalAttachment; options: MetadataOptions }) {
  const navigate = useNavigate(), meta = file.archive
  return <div className={styles.fileInformation}>
    <dl>
      <div>
        <dt>Fecha de estudio</dt>
        <dd>
          {meta?.studyDate ? formatDateOnly(meta.studyDate) : "Sin fecha de estudio"}
        </dd>
      </div>
      <div>
        <dt>Tipo clínico</dt>
        <dd>
          {fileTypeLabel(file)}
        </dd>
      </div>
      <div>
        <dt>Categoría</dt>
        <dd>
          {fileCategory(file, options.catalog)?.name ?? "Sin categoría"}
        </dd>
      </div>
      <div>
        <dt>Profesional</dt>
        <dd>
          {options.professionals[meta?.professionalId ?? ""] || "Sin profesional asociado"}
        </dd>
      </div>
      <div>
        <dt>Zona</dt>
        <dd>
          {meta?.zone || "No registrada"}
        </dd>
      </div>
      <div>
        <dt>Etiquetas</dt>
        <dd>
          {options.catalog.tags.filter(item => meta?.tagIds.includes(item.id)).map(item => item.name).join(", ") || "Sin etiquetas"}
        </dd>
      </div>
      <div>
        <dt>Original</dt>
        <dd>{file.name} · {bytesLabel(file.size)}</dd>
      </div>
      <div>
        <dt>Cargado el / por</dt>
        <dd>{new Date(file.createdAt).toLocaleString("es")} · {meta?.uploadedBy?.name ?? "Autor no registrado en el archivo anterior"}</dd>
      </div>
    </dl>
    {meta?.notes && <p className={styles.notes}>
      {meta.notes}
    </p>}
    {meta?.encounterId && <Button variant="outline" onClick={() => navigate(`/historial-clinico/paciente/${options.history.record.patientId}?atencion=${encodeURIComponent(meta.encounterId!)}`)}>Abrir atención vinculada</Button>}
    {meta?.treatmentId && <p>Tratamiento: {options.treatments[meta.treatmentId] ?? "Vínculo conservado"}</p>}
    {meta?.audit.length ? <details>
      <summary>Historial de cambios del archivo</summary>
      <ul>
        {meta.audit.map((entry, index) => <li key={index}>{entry.action} · {new Date(entry.at).toLocaleString("es")} · {entry.actor.name}{entry.fields.length > 0 && <small>Campos: {entry.fields.join(", ")}</small>}</li>)}
      </ul>
    </details> : null}
  </div>
}
export function FileViewer({ patientId, patientName, files, fileId, onFile, options, onClose, fullscreen = false }: { patientId: string; patientName: string; files: DentalAttachment[]; fileId: string; onFile: (id: string) => void; options: MetadataOptions; onClose: () => void; fullscreen?: boolean }) {
  const root = useRef<HTMLDivElement>(null), [transform, setTransform] = useState(initialTransform), [info, setInfo] = useState(false), [error, setError] = useState(""), [isFull, setIsFull] = useState(false)
  const index = files.findIndex(item => item.id === fileId), file = files[index]
  function move(direction: number) { const next = files[index + direction]; if (next) { setTransform(initialTransform()); setError(""); onFile(next.id) } }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true]"))) return
      if (event.key === "ArrowLeft" && files[index - 1]) { event.preventDefault(); setTransform(initialTransform()); onFile(files[index - 1].id) }
      if (event.key === "ArrowRight" && files[index + 1]) { event.preventDefault(); setTransform(initialTransform()); onFile(files[index + 1].id) }
    }
    window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener)
  }, [files, index, onFile])
  useEffect(() => { const change = () => setIsFull(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", change); return () => document.removeEventListener("fullscreenchange", change) }, [])
  const requestedFullscreen = useRef(false)
  const setRoot = useCallback((element: HTMLDivElement | null) => {
    root.current = element
    // The dialog portal can mount after the parent's effect. Request once its node exists.
    if (element && fullscreen && !requestedFullscreen.current) {
      requestedFullscreen.current = true
      void toggleFullscreen(element).catch(error => setError(error.message))
    }
  }, [fullscreen])
  useEffect(() => { const element = root.current; return () => { if (element && document.fullscreenElement === element) void document.exitFullscreen().catch(() => undefined) } }, [])
  async function run(operation: () => Promise<unknown>) { setError(""); try { await operation() } catch (error) { setError(error instanceof Error ? error.message : "No se pudo completar la operación") } }
  if (!file) return null
  const image = isClinicalImage(file)
  return <Dialog open onOpenChange={open => !open && onClose()}>
    <DialogContent
      ref={setRoot}
      variant="complex"
      className={styles.viewer}
    >
      <DialogHeader>
        <DialogTitle>
          {fileName(file)}
        </DialogTitle>
        <DialogDescription>{patientName} · {file.archive?.studyDate ? formatDateOnly(file.archive.studyDate) : "Sin fecha de estudio"} · {index + 1} de {files.length}</DialogDescription>
      </DialogHeader>
      <div className={styles.viewerToolbar}>

        <IconAction
          label="Archivo anterior"
          icon={ChevronLeft}
          disabled={index < 1}
          onClick={() => move(-1)}
        />
        <IconAction
          label="Archivo siguiente"
          icon={ChevronRight}
          disabled={index === files.length - 1}
          onClick={() => move(1)}
        />

        {image && <>
          <IconAction
            label="Acercar imagen"
            icon={ZoomIn}
            onClick={() => setTransform({ ...transform, zoom: Math.min(8, transform.zoom + .25) })}
          />
          <IconAction
            label="Alejar imagen"
            icon={ZoomOut}
            disabled={transform.zoom <= .25}
            onClick={() => setTransform({ ...transform, zoom: Math.max(.25, transform.zoom - .25) })}
          />
          <span>{Math.round(transform.zoom * 100)}%</span>
          <IconAction
            label="Ajustar imagen"
            icon={Scan}
            onClick={() => setTransform({ ...transform, zoom: 1, x: 0, y: 0 })}
          />
          <IconAction
            label="Girar a la izquierda"
            icon={RotateCcw}
            onClick={() => setTransform({ ...transform, rotation: transform.rotation - 90, x: 0, y: 0 })}
          />
          <IconAction
            label="Girar a la derecha"
            icon={RotateCw}
            onClick={() => setTransform({ ...transform, rotation: transform.rotation + 90, x: 0, y: 0 })}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTransform(initialTransform())}
          >Restablecer</Button>
        </>}

        <IconAction
          label={isFull ? "Salir de pantalla completa" : "Pantalla completa"}
          icon={isFull ? Minimize : Maximize}
          onClick={() => void run(() => toggleFullscreen(root.current))}
        />
        <IconAction
          label="Mostrar información"
          icon={Info}
          pressed={info}
          onClick={() => setInfo(!info)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void run(() => downloadOriginal(patientId, file))}
        ><Download />Descargar original</Button>

      </div>
      <DialogBody className={styles.viewerBody}>
        {error && <p role="alert" className={styles.error}>
          {error}
        </p>}
        {image ? <ImageSurface
          key={file.id}
          patientId={patientId}
          file={file}
          transform={transform}
          onChange={setTransform}
        /> : file.mime === "application/pdf" ? <PdfPreview
          key={file.id}
          patientId={patientId}
          file={file}
        /> : <p>No hay un visor compatible con este formato. Puedes descargar el original.</p>}
        {info && <FileInformation file={file} options={options} />}
      </DialogBody>
    </DialogContent>
  </Dialog>
}
