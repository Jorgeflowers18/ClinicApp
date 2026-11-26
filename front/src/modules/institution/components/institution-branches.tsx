import { useRef, useState } from "react"
import { Building2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { getErrorMessage } from "@/shared/lib/error-message"

import { branchLabel, type InstitutionBranch } from "../types/institution.types"
import styles from "./institution-branches.module.css"

type BranchDraft = Pick<InstitutionBranch, "name" | "address" | "phone" | "hours">
type Editor = { original: InstitutionBranch | null; draft: BranchDraft }
type Props = { branches: InstitutionBranch[]; onCommit: (branches: InstitutionBranch[]) => Promise<void>; editorOnly?: boolean; onEditorClose?: () => void }


function BranchActions({ branch, onEdit, onDelete }: {
  branch: InstitutionBranch
  onEdit: (branch: InstitutionBranch, trigger: HTMLButtonElement | null) => void
  onDelete: (branch: InstitutionBranch, trigger: HTMLButtonElement | null) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button ref={triggerRef} variant="ghost" size="icon" aria-label={`Acciones de sede ${branchLabel(branch)}`} />}>
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.menu}>
        <DropdownMenuItem onClick={() => onEdit(branch, triggerRef.current)}><Pencil />Editar sede</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(branch, triggerRef.current)}><Trash2 />Eliminar sede</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function InstitutionBranches({ branches, onCommit, editorOnly = false, onEditorClose }: Props) {
  const [editor, setEditor] = useState<Editor | null>(editorOnly ? { original: null, draft: { name: "Nueva sede", address: "", phone: "", hours: "" } } : null)
  const [deleting, setDeleting] = useState<InstitutionBranch | null>(null)
  const [error, setError] = useState("")
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const createRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLButtonElement | null>(null)

  const returnFocus = () => {
    const trigger = returnFocusRef.current
    return trigger?.isConnected && trigger.getClientRects().length ? trigger : createRef.current
  }
  const openCreate = (trigger: HTMLButtonElement) => {
    returnFocusRef.current = trigger
    setError("")
    setEditor({ original: null, draft: { name: "Nueva sede", address: "", phone: "", hours: "" } })
  }
  const openEdit = (branch: InstitutionBranch, trigger: HTMLButtonElement | null) => {
    returnFocusRef.current = trigger
    setError("")
    setEditor({ original: branch, draft: { name: branch.name, address: branch.address, phone: branch.phone, hours: branch.hours } })
  }
  const openDelete = (branch: InstitutionBranch, trigger: HTMLButtonElement | null) => {
    returnFocusRef.current = trigger
    setError("")
    setDeleting(branch)
  }
  const saveBranch = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editor || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const original = editor.original
      // Una sede nueva va sin id: lo pone el servidor al guardar.
      const next = original
        ? branches.map((branch) => branch.id === original.id ? { ...branch, ...editor.draft } : branch)
        : [...branches, { ...editor.draft, id: "", isMain: branches.length === 0 }]
      await onCommit(next)
      setEditor(null)
      onEditorClose?.()
      setError("")
      toast.success(editor.original ? "Sede actualizada" : "Sede creada")
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally { busyRef.current = false; setBusy(false) }
  }
  const deleteBranch = async () => {
    if (!deleting || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await onCommit(branches.filter((branch) => branch.id !== deleting.id))
      setDeleting(null)
      setError("")
      toast.success("Sede eliminada")
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally { busyRef.current = false; setBusy(false) }
  }
  const condition = (branch: InstitutionBranch) => branch.isMain
    ? <Badge variant="secondary" className={styles.principal}>Principal</Badge>
    : <span className={styles.secondary}>Sucursal</span>
  const actions = (branch: InstitutionBranch) => <BranchActions branch={branch} onEdit={openEdit} onDelete={openDelete} />
  const editorField = (key: keyof BranchDraft, label: string) => editor && (
    <div className={styles.field}>
      <label htmlFor={`sede-${key}`}>{label}</label>
      {key === "hours" ? <Textarea id={`sede-${key}`} rows={2} placeholder="Días y horarios de atención" value={editor.draft[key]} onChange={(event) => {
        setEditor({ ...editor, draft: { ...editor.draft, [key]: event.target.value } })
        setError("")
      }} /> : <Input id={`sede-${key}`} type={key === "phone" ? "tel" : "text"} placeholder={key === "name" ? "Nombre de esta ubicación" : key === "address" ? "Calle, número y ciudad" : "Teléfono de contacto"} value={editor.draft[key]} onChange={(event) => {
        setEditor({ ...editor, draft: { ...editor.draft, [key]: event.target.value } })
        setError("")
      }} />}
    </div>
  )

  return (
    <>
      {!editorOnly && <Card className={styles.section} data-institution-branches>
        <CardHeader className={styles.header}>
          <div className={styles.heading}>
            <CardTitle role="heading" aria-level={2}>Sedes <span className={styles.count}>{branches.length}</span></CardTitle>
            <p>Consulta y administra las ubicaciones de tu institución.</p>
          </div>
          {branches.length > 0 && <Button ref={createRef} variant="outline" onClick={(event) => openCreate(event.currentTarget)}><Plus />Crear sede</Button>}
        </CardHeader>
        <CardContent className={styles.content}>
          {branches.length === 0 ? (
            <div className={styles.empty}>
              <Building2 aria-hidden="true" />
              <h3>Todavía no hay sedes registradas.</h3>
              <p>Crea la primera sede para gestionar sus datos de contacto, ubicación y horarios.</p>
              <Button ref={createRef} onClick={(event) => openCreate(event.currentTarget)}><Plus />Crear primera sede</Button>
            </div>
          ) : <>
            <div className={styles.desktop}>
              <Table className={styles.table} aria-label="Sedes de la institución">
                <TableHeader><TableRow>
                  <TableHead scope="col">Sede</TableHead><TableHead scope="col">Dirección</TableHead>
                  <TableHead scope="col">Teléfono</TableHead><TableHead scope="col">Horarios</TableHead>
                  <TableHead scope="col">Tipo</TableHead><TableHead scope="col"><span className="sr-only">Acciones</span></TableHead>
                </TableRow></TableHeader>
                <TableBody>{branches.map((branch) => <TableRow key={branch.id}>
                  <TableCell className={styles.name}>{branchLabel(branch)}</TableCell>
                  <TableCell>{branch.address || "Sin dirección"}</TableCell>
                  <TableCell>{branch.phone || "Sin teléfono"}</TableCell>
                  <TableCell>{branch.hours || "Sin horarios"}</TableCell>
                  <TableCell>{condition(branch)}</TableCell><TableCell>{actions(branch)}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className={styles.mobile} aria-label="Sedes de la institución">
              {branches.map((branch) => <li className={styles.branch} key={branch.id}>
                <div className={styles.branchHeader}>
                  <div><h3>{branchLabel(branch)}</h3>{condition(branch)}</div>{actions(branch)}
                </div>
                <dl className={styles.facts}>
                  <div><dt>Dirección</dt><dd>{branch.address || "Sin dirección"}</dd></div>
                  <div><dt>Teléfono</dt><dd>{branch.phone || "Sin teléfono"}</dd></div>
                  <div><dt>Horarios</dt><dd>{branch.hours || "Sin horarios"}</dd></div>
                </dl>
              </li>)}
            </ul>
          </>}
        </CardContent>
      </Card>}

      <Dialog open={editor !== null} onOpenChange={(open) => { if (!open && !busy) { setEditor(null); setError(""); onEditorClose?.() } }}>
        <DialogContent variant="medium" className={styles.editor} finalFocus={returnFocus}>
          <DialogHeader className={styles.editorHeader}>
            <DialogTitle>{editor?.original ? "Editar sede" : "Nueva sede"}</DialogTitle>
            <DialogDescription>{editor?.original ? "Actualiza los datos de esta ubicación de la institución." : "Registra una nueva ubicación de la institución."}</DialogDescription>
          </DialogHeader>
          {editor && <form className={styles.editorForm} noValidate onSubmit={(event) => { void saveBranch(event) }} aria-busy={busy}>
            <div className={styles.editorBody}>
              <fieldset className={styles.group}>
                <legend>Información de la sede</legend>
                {editorField("name", "Nombre de la sede")}{editorField("address", "Dirección")}
              </fieldset>
              <fieldset className={styles.group}>
                <legend>Contacto y horarios</legend>
                {editorField("phone", "Teléfono")}{editorField("hours", "Horarios")}
              </fieldset>
              {error && <p role="alert" className={styles.error}>{error}</p>}
            </div>
            <div className={styles.editorFooter} data-institution-editor-actions>
              <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditor(null); setError(""); onEditorClose?.() }}>Cancelar</Button>
              <Button type="submit" disabled={busy}>Guardar sede</Button>
            </div>
          </form>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) { setDeleting(null); setError("") } }}>
        <AlertDialogContent finalFocus={returnFocus} className={styles.confirm}>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta sede?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará «{deleting ? branchLabel(deleting) : "Nueva sede"}» del listado de sedes. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <AlertDialogFooter>
            <Button variant="outline" autoFocus onClick={() => { setDeleting(null); setError("") }}>Cancelar</Button>
            <Button variant="destructive" disabled={busy} onClick={() => { void deleteBranch() }}>Eliminar sede</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
