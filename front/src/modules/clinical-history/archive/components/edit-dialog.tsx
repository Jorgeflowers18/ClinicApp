import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog"
import type { DentalAttachment } from "../../types/clinical-history.types"
import { archiveApi } from "../api"
import { useArchiveWrite } from "../hooks"
import { bytesLabel, fileDraft, fileVersion, formatLabel } from "../lib/classification"
import { MetadataFields, type MetadataOptions } from "./metadata-fields"
import styles from "../archive.module.css"

export function EditFileDialog({ patientId, file, patientName, options, onClose }: { patientId: string; file: DentalAttachment; patientName: string; options: MetadataOptions; onClose: () => void }) {
  const [value, setValue] = useState(() => fileDraft(file)), [error, setError] = useState("")
  const write = useArchiveWrite(patientId)
  async function save() {
    setError("")
    try { await write.mutateAsync(() => archiveApi.edit(patientId, file.id, fileVersion(file), value)); onClose() }
    catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar") }
  }
  return <Dialog open onOpenChange={open => !open && !write.isPending && onClose()}>
    <DialogContent variant="wide">
      <DialogHeader>
        <DialogTitle>Editar metadatos</DialogTitle>
        <DialogDescription>{patientName}. Esta operación conserva el original y la identidad del paciente.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <form id="clinical-file-edit" onSubmit={event => { event.preventDefault(); void save() }}>
          <fieldset disabled={write.isPending}>
            <MetadataFields
              value={value}
              onChange={setValue}
              options={options}
            />
          </fieldset>
          <dl className={styles.originalInfo}>
            <div>
              <dt>Original</dt>
              <dd>
                {file.name}
              </dd>
            </div>
            <div>
              <dt>Formato / tamaño</dt>
              <dd>{formatLabel(file)} · {bytesLabel(file.size)}</dd>
            </div>
            <div>
              <dt>Cargado el</dt>
              <dd>
                {new Date(file.createdAt).toLocaleString("es")}
              </dd>
            </div>
            <div>
              <dt>Cargado por</dt>
              <dd>
                {file.archive?.uploadedBy?.name || "No registrado en el archivo anterior"}
              </dd>
            </div>
          </dl>
          {error && <p role="alert" className={styles.error}>
            {error}
          </p>}
        </form>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          disabled={write.isPending}
          onClick={onClose}
        >Cancelar</Button>
        <Button
          type="submit"
          form="clinical-file-edit"
          disabled={write.isPending}
        >
          {write.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
