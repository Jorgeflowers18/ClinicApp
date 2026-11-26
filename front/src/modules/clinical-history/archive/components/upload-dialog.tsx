import { useEffect, useRef, useState } from "react"
import { Check, FileText, Upload, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { createId } from "@/shared/lib/id"
import { useModalAccordion } from "@/shared/hooks/use-modal-accordion"
import { serverFieldIssues,type FieldIssues } from "@/shared/lib/field-issues"
import { getErrorMessage } from "@/shared/lib/error-message"
import { fileDraftIssues } from "../lib/validation"
import { allowedAttachmentTypes } from "../../types/clinical-history.types"
import { archiveApi } from "../api"
import { useArchiveWrite, useBlobUrl } from "../hooks"
import { emptyFileDraft, type ClinicalFileDraft } from "../types"
import { maxArchiveBatch, maxArchiveBatchBytes } from "../lib/files"
import { bytesLabel, formatLabel } from "../lib/classification"
import { ArchiveSection, IconAction } from "./controls"
import { MetadataFields, type MetadataOptions } from "./metadata-fields"
import styles from "../archive.module.css"

interface PendingFile { id: string; file: File; overrides: Partial<ClinicalFileDraft>; status: "pending" | "saving" | "saved" | "error"; error?: string }
function PendingPreview({ file }: { file: File }) {
  const url = useBlobUrl(file.type.startsWith("image/") ? file : null)
  return <div className={styles.pendingThumb}>
    {url ? <img src={url} alt="" /> : <FileText aria-hidden="true" />}
  </div>
}
export function UploadDialog({ patientId, patientName, recordNumber, options, onClose }: { patientId: string; patientName: string; recordNumber: string; options: MetadataOptions; onClose: () => void }) {
  const [files, setFiles] = useState<PendingFile[]>([]), [common, setCommon] = useState(emptyFileDraft), [error, setError] = useState(""), [busy, setBusy] = useState(false)
  const write = useArchiveWrite(patientId), input = useRef<HTMLInputElement>(null), errorRef = useRef<HTMLParagraphElement>(null), mounted = useRef(true)
  const body=useRef<HTMLDivElement>(null),lock=useRef(false)
  const accordion=useModalAccordion(body,"files"),section=accordion.open,setSection=accordion.request
  const [attempted,setAttempted]=useState(false),[remote,setRemote]=useState<Record<string,FieldIssues>>({})
  const actor = useAuthStore(state => state.user)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  function add(incoming: File[]) {
    setError("")
    if (files.length + incoming.length > maxArchiveBatch) { setError(`Selecciona hasta ${maxArchiveBatch} archivos por lote.`); return }
    if ([...files.map(item => item.file), ...incoming].reduce((sum, item) => sum + item.size, 0) > maxArchiveBatchBytes) { setError("El lote admite hasta 100 MB en esta demostración."); return }
    const added: PendingFile[] = []
    for (const file of incoming) {
      if ([...files, ...added].some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) { setError(`«${file.name}» ya está seleccionado.`); continue }
      added.push({ id: createId(), file, overrides: {}, status: "pending", ...(!file.size ? { status: "error", error: "Archivo vacío" } : file.size > 20 * 1024 * 1024 ? { status: "error", error: "Supera los 20 MB" } : {}) })
    }
    setFiles(previous => [...previous, ...added])
  }
  const draftFor = (item: PendingFile): ClinicalFileDraft => ({ ...common, displayName: common.displayName || item.file.name, ...item.overrides })
  const issuesFor=(item:PendingFile):FieldIssues=>item.status==="saved"?{}:{...(attempted?fileDraftIssues(draftFor(item)):{}),...remote[item.id]}
  function reveal(item:PendingFile,issues:FieldIssues){const field=Object.keys(issues).find(key=>key!=="file")??"file";accordion.request(field==="file"?"files":"file:"+item.id,'[data-validation-field="'+CSS.escape(item.id+"."+field)+'"]')}
  function changeCommon(next:ClinicalFileDraft){const changed=Object.keys(next).filter(key=>JSON.stringify(next[key as keyof ClinicalFileDraft])!==JSON.stringify(common[key as keyof ClinicalFileDraft]));setRemote(current=>Object.fromEntries(Object.entries(current).map(([id,issues])=>[id,Object.fromEntries(Object.entries(issues).filter(([key])=>!changed.includes(key)||key in(files.find(item=>item.id===id)?.overrides??{})))])));setCommon(next)}
  function override(item: PendingFile, next: ClinicalFileDraft) {
    const previous = draftFor(item)
    const changes = Object.fromEntries(Object.keys(next).filter(key => JSON.stringify(next[key as keyof ClinicalFileDraft]) !== JSON.stringify(previous[key as keyof ClinicalFileDraft])).map(key => [key, next[key as keyof ClinicalFileDraft]]))
    setFiles(current => current.map(row => row.id === item.id ? { ...row,status:"pending",error:undefined, overrides: { ...row.overrides, ...changes } } : row))
    setRemote(current=>({...current,[item.id]:Object.fromEntries(Object.entries(current[item.id]??{}).filter(([key])=>!(key in changes)))}))
  }
  async function save() {
    if(lock.current)return
    setError("")
    setAttempted(true)
    const pending = files.filter(item => item.status !== "saved")
    if (!pending.length) { setError("Selecciona al menos un archivo nuevo."); setSection("files"); return }
    lock.current=true
    setBusy(true); setSection("files")
    let failures = 0
    let firstFailure:{item:PendingFile;issues:FieldIssues}|null=null
    for (const item of pending) {
      if (!mounted.current) break
      const issues=fileDraftIssues(draftFor(item)),exam=draftFor(item).examRequestId
      if(exam&&pending.some(other=>other.id!==item.id&&draftFor(other).examRequestId===exam))issues.examRequestId="Un examen solicitado admite un único resultado. Ajusta este vínculo."
      if(Object.keys(issues).length){failures++;firstFailure??={item,issues};setRemote(current=>({...current,[item.id]:issues}));setFiles(current=>current.map(row=>row.id===item.id?{...row,status:"error",error:"Requiere corrección"}:row));continue}
      setFiles(current => current.map(row => row.id === item.id ? { ...row, status: "saving", error: undefined } : row))
      try {
        await write.mutateAsync(() => archiveApi.attach(patientId, item.file, draftFor(item)))
        if (mounted.current) setFiles(current => current.map(row => row.id === item.id ? { ...row, status: "saved", error: undefined } : row))
      } catch (error) {
        failures++
        const issues=serverFieldIssues(error,[...Object.keys(draftFor(item)),"file"])
        firstFailure??={item,issues}
        if (mounted.current){setRemote(current=>({...current,[item.id]:issues}));setFiles(current => current.map(row => row.id === item.id ? { ...row, status: "error", error:getErrorMessage(error) } : row))}
      }
    }
    lock.current=false
    if (mounted.current) { setBusy(false); if (failures) { setError(`${failures} ${failures===1?"archivo requiere":"archivos requieren"} atención. Revisa cada archivo; los guardados no se repetirán al reintentar.`) }if(firstFailure)reveal(firstFailure.item,firstFailure.issues) }
  }
  const saved = files.filter(item => item.status === "saved").length
  const toggle = (name: string) => { if (!busy) setSection(section === name ? null : name) }
  return <Dialog open onOpenChange={open => !open && !busy && onClose()}>
    <DialogContent
      variant="wide"
      className={styles.uploadDialog}
      aria-busy={busy}
    >
      <DialogHeader>
        <DialogTitle>Adjuntar archivos clínicos</DialogTitle>
        <DialogDescription>{patientName} · {recordNumber}. Los originales se conservan sin modificaciones.</DialogDescription>
      </DialogHeader>
      <DialogBody ref={body}>

        <ArchiveSection
          title="Archivos"
          value="files"
          open={section === "files"}
          onToggle={() => toggle("files")}
          status={`${files.length} seleccionados · ${saved} guardados`}
        >

          <div
            className={styles.dropzone}
            onDragOver={event => event.preventDefault()}
            onDrop={event => { event.preventDefault(); if (!busy) add(Array.from(event.dataTransfer.files)) }}
          >
            <Upload aria-hidden="true" />
            <p>Arrastra archivos o selecciónalos desde tu dispositivo.</p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => input.current?.click()}
            >Seleccionar archivos</Button>
            <small>JPG, PNG, WebP y PDF · 20 MB por archivo · 20 archivos / 100 MB por lote. No admite DICOM ni modelos 3D.</small>
            <Input
              ref={input}
              type="file"
              multiple
              className="sr-only"
              aria-label="Seleccionar archivos clínicos"
              accept={allowedAttachmentTypes.join(",")}
              onChange={event => { add(Array.from(event.target.files ?? [])); event.target.value = "" }}
            />
          </div>

          <ul className={styles.pendingList}>
            {files.map(item => <li key={item.id}>
              <PendingPreview file={item.file} />
              <div>
                <strong>
                  {item.file.name}
                </strong>
                <small>{formatLabel({ mime: item.file.type })} · {bytesLabel(item.file.size)}</small>
                <p role={item.status === "error" ? "alert" : "status"} tabIndex={-1} data-validation-field={`${item.id}.file`}>
                  {item.status === "saved" ? <><Check aria-hidden="true" />Guardado</> : item.status === "saving" ? "Validando y guardando original…" : item.error ?? "Pendiente de guardar"}
                </p>
                {Object.entries(issuesFor(item)).map(([field,message])=><small className="text-destructive" key={field}>{message}</small>)}
                {item.status==="error"&&<Button type="button" size="sm" variant="link" onClick={()=>reveal(item,issuesFor(item))}>Corregir archivo</Button>}
              </div>
              <IconAction
                label={`Quitar ${item.file.name}`}
                icon={Trash2}
                disabled={busy || item.status === "saved"}
                onClick={() => setFiles(current => current.filter(row => row.id !== item.id))}
              />
            </li>)}
          </ul>

        </ArchiveSection>

        <ArchiveSection
          title="Clasificación clínica"
          value="classification"
          open={section === "classification"}
          onToggle={() => toggle("classification")}
          status="Tipo, categoría y fecha"
        >
          <fieldset disabled={busy}>
            <MetadataFields
              value={common}
              name={false}
              onChange={changeCommon}
              options={options}
              part="classification"
            />
          </fieldset>
        </ArchiveSection>

        <ArchiveSection
          title="Información adicional"
          value="additional"
          open={section === "additional"}
          onToggle={() => toggle("additional")}
          status="Vínculos, etiquetas y notas"
        >
          <fieldset disabled={busy}>
            <MetadataFields
              value={common}
              name={false}
              onChange={changeCommon}
              options={options}
              part="additional"
            />
            <p className={styles.hint}>Cargado por: {actor?.name ?? "Sesión no disponible"}. La fecha de carga se registra al guardar. No sustituye la fecha de estudio.</p>
          </fieldset>
        </ArchiveSection>

        {files.some(item => item.status !== "saved") && <div className={styles.individual}>
          <h3>Ajustes por archivo</h3>
          <small>Los campos comunes se aplican a todos. Los ajustes individuales tienen prioridad.</small>
          {files.filter(item => item.status !== "saved").map(item => <ArchiveSection key={item.id} value={"file:"+item.id} title={item.file.name} open={section==="file:"+item.id} onToggle={()=>toggle("file:"+item.id)}>
            <fieldset disabled={busy}>
              <MetadataFields value={draftFor(item)} onChange={next=>override(item,next)} options={options} issues={issuesFor(item)} prefix={item.id+"."}/>
              <Button type="button" variant="ghost" onClick={()=>setFiles(current=>current.map(row=>row.id===item.id?{...row,overrides:{}}:row))}>Restablecer ajustes individuales</Button>
            </fieldset>
          </ArchiveSection>)}
        </div>}

        {error && <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className={styles.error}
        >
          {error}
        </p>}

        {saved > 0 && <p role="status">{saved} de {files.length} archivos guardados en el archivo clínico.</p>}

      </DialogBody>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onClose}
        >
          {saved === files.length && saved > 0 ? "Cerrar" : "Cancelar"}
        </Button>
        <Button
          type="button"
          disabled={busy || !files.some(item => item.status !== "saved")}
          onClick={() => void save()}
        >
          {busy ? "Guardando archivos…" : saved ? "Guardar archivos restantes" : "Guardar archivos"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
