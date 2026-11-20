import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { Camera, ImagePlus, LoaderCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { getErrorMessage } from "@/shared/lib/error-message"
import { UserAvatar } from "./user-avatar"
import styles from "./profile-photo-controls.module.css"

export function ProfilePhotoControls({ name, image, disabled, avatarClassName, onCommit, children }: {
  name: string; image: string | null; disabled: boolean; avatarClassName: string; onCommit: (image: string | null) => Promise<void>; children?: ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const reader = useRef<FileReader | null>(null)
  const version = useRef(0)
  const operation = useRef(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [candidate, setCandidate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => () => { version.current++; reader.current?.abort() }, [])

  function selectFile() {
    if (disabled || operation.current) return
    setMenuOpen(false)
    setStatus(null)
    input.current?.click()
  }

  function closePreview() {
    if (operation.current) return
    version.current++
    reader.current?.abort()
    setReading(false)
    setCandidate(null)
    setError(null)
    setPreviewOpen(false)
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || disabled || operation.current) return
    const token = ++version.current
    reader.current?.abort()
    setCandidate(null)
    setError(null)
    setStatus(null)
    setPreviewOpen(true)
    setReading(true)
    const fail = () => {
      if (token !== version.current) return
      setReading(false)
      setError("No se pudo leer la imagen. La fotografía guardada no ha cambiado.")
    }
    if (file.type && !file.type.startsWith("image/")) { fail(); return }
    const fileReader = new FileReader()
    reader.current = fileReader
    fileReader.onerror = fail
    fileReader.onload = async () => {
      try {
        if (typeof fileReader.result !== "string") { fail(); return }
        const src = fileReader.result
        const image = new Image()
        image.src = src
        await image.decode()
        if (token !== version.current) return
        setCandidate(src)
        setReading(false)
      } catch { fail() }
    }
    try { fileReader.readAsDataURL(file) } catch { fail() }
  }

  async function confirm(kind: "upload" | "delete") {
    if (operation.current || disabled || (kind === "upload" && !candidate)) return
    operation.current = true
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await onCommit(kind === "delete" ? null : candidate)
      const message = kind === "delete" ? "Fotografía eliminada" : "Fotografía guardada"
      setStatus(message)
      setPreviewOpen(false)
      setDeleteOpen(false)
      setCandidate(null)
      toast.success(message)
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally { operation.current = false; setBusy(false) }
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={(open) => { if (!busy) setMenuOpen(open) }}>
        <DropdownMenuTrigger ref={trigger} render={<button type="button" className={styles.avatarButton} disabled={disabled || busy} aria-label="Opciones de fotografía" />}>
          <UserAvatar name={name} image={image} location="profile" className={avatarClassName} />
          <span className={styles.camera}><Camera aria-hidden="true" /></span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className={styles.menu}>
          <DropdownMenuItem onClick={selectFile}><ImagePlus aria-hidden="true" />{image ? "Cambiar fotografía" : "Subir fotografía"}</DropdownMenuItem>
          {image && <DropdownMenuItem variant="destructive" onClick={() => { setMenuOpen(false); setError(null); setStatus(null); setDeleteOpen(true) }}><Trash2 aria-hidden="true" />Eliminar fotografía</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      {children}
      <input ref={input} id="user-profile-photo" type="file" accept="image/*" hidden onChange={handleFile} />
      <Button variant="outline" className={styles.upload} disabled={disabled || busy} onClick={selectFile}><ImagePlus aria-hidden="true" />{image ? "Cambiar foto" : "Subir foto"}</Button>
      {status && <p className={styles.status} role="status">{status}</p>}

      <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) closePreview() }}>
        <DialogContent variant="small" className={styles.dialog} showCloseButton={!busy} finalFocus={trigger}>
          <DialogHeader><DialogTitle>Vista previa de fotografía</DialogTitle><DialogDescription>La fotografía guardada se conserva hasta que confirmes la nueva imagen.</DialogDescription></DialogHeader>
          <div className={styles.previewBody} aria-busy={reading}>
            {reading ? <p role="status"><LoaderCircle className="animate-spin" aria-hidden="true" />Leyendo imagen…</p> : candidate && <img src={candidate} alt="Vista previa de fotografía" />}
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <DialogFooter><Button variant="outline" disabled={busy} onClick={closePreview}>Cancelar</Button><Button disabled={busy || reading || !candidate} onClick={() => void confirm("upload")}>{busy ? "Guardando…" : "Confirmar fotografía"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!busy) { setDeleteOpen(open); setError(null) } }}>
        <AlertDialogContent className={styles.dialog} finalFocus={trigger}>
          <AlertDialogHeader><AlertDialogTitle>Eliminar fotografía</AlertDialogTitle><AlertDialogDescription>Se eliminará la fotografía guardada. Volverán a mostrarse tus iniciales o el icono de usuario si no hay un nombre disponible.</AlertDialogDescription></AlertDialogHeader>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <AlertDialogFooter><Button variant="outline" disabled={busy} onClick={() => { setDeleteOpen(false); setError(null) }}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => void confirm("delete")}>{busy ? "Eliminando…" : "Eliminar fotografía"}</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
