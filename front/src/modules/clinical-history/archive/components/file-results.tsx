import { useNavigate } from "react-router-dom"
import { Archive, ArchiveRestore, Download, Eye, FileText, ImageOff, Images, Maximize, MoreHorizontal, Pencil, Link } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatDateOnly } from "@/shared/lib/date"
import type { DentalAttachment } from "../../types/clinical-history.types"
import { useVisibleThumbnail } from "../hooks"
import { bytesLabel, fileCategory, fileName, fileTypeLabel, formatLabel, isClinicalImage } from "../lib/classification"
import type { MetadataOptions } from "./metadata-fields"
import styles from "../archive.module.css"

export function FileThumbnail({ patientId, file }: { patientId: string; file: DentalAttachment }) {
  const { ref, query, url } = useVisibleThumbnail(patientId, file.id, isClinicalImage(file))
  return <div ref={ref} className={styles.thumbnail}>
    {url ? <img
      src={url}
      alt=""
      loading="lazy"
    /> : query.isError ? <span title="Miniatura no disponible">
      <ImageOff aria-hidden="true" />
      <span className="sr-only">Miniatura no disponible</span>
    </span> : <>
      <FileText aria-hidden="true" />
      <small>
        {query.isFetching ? "Cargando…" : formatLabel(file)}
      </small>
    </>}
  </div>
}
interface FileResultsProps { patientId: string; files: DentalAttachment[]; view: string; selected: string[]; options: MetadataOptions; writable: boolean; onSelect: (file: DentalAttachment) => void; onPreview: (file: DentalAttachment, fullscreen?: boolean) => void; onEdit: (file: DentalAttachment) => void; onArchive: (file: DentalAttachment) => void; onDownload: (file: DentalAttachment) => void }
function FileActions({ file, ...props }: Omit<FileResultsProps, "files" | "view"> & { file: DentalAttachment }) {
  const navigate = useNavigate()
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger render={<Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Acciones de ${fileName(file)}`}
    >
      <MoreHorizontal />
    </Button>} />
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => props.onPreview(file)}><Eye />Vista previa</DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.onPreview(file, true)}><Maximize />Pantalla completa</DropdownMenuItem>
      {isClinicalImage(file) && <DropdownMenuItem disabled={!props.selected.includes(file.id) && props.selected.length === 2} onClick={() => props.onSelect(file)}>
        <Images />
        {props.selected.includes(file.id) ? "Quitar de comparación" : "Seleccionar para comparar"}
      </DropdownMenuItem>}
      {props.writable && <>
        <DropdownMenuItem onClick={() => props.onEdit(file)}><Pencil />Editar metadatos, categoría y etiquetas</DropdownMenuItem>
      </>}
      {file.archive?.encounterId && <DropdownMenuItem onClick={() => navigate(`/historial-clinico/paciente/${props.patientId}?atencion=${encodeURIComponent(file.archive!.encounterId!)}`)}><Link />Abrir atención vinculada</DropdownMenuItem>}
      <DropdownMenuItem onClick={() => props.onDownload(file)}><Download />Descargar original</DropdownMenuItem>
      {props.writable && <>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => props.onArchive(file)}>
          {file.archive?.archivedAt ? <ArchiveRestore /> : <Archive />}
          {file.archive?.archivedAt ? "Restaurar archivo" : "Archivar archivo"}
        </DropdownMenuItem>
      </>}
    </DropdownMenuContent>
  </DropdownMenu>
}
export function FileResults(props: FileResultsProps) {
  const { patientId, files, selected, options, view } = props
  const date = (file: DentalAttachment) => file.archive?.studyDate ? formatDateOnly(file.archive.studyDate, { day: "numeric", month: "short", year: "numeric" }) : "Sin fecha de estudio"
  const category = (file: DentalAttachment) => {
    const item = fileCategory(file, options.catalog); return <span className={styles.category} data-tone={item?.color || "neutral"}>
      {item?.name || "Sin categoría"}
      {item?.archivedAt ? " (archivada)" : ""}
    </span>
  }
  const checkbox = (file: DentalAttachment) => isClinicalImage(file) && <label className={styles.selectFile}>
    <input
      type="checkbox"
      checked={selected.includes(file.id)}
      disabled={!selected.includes(file.id) && selected.length === 2}
      onChange={() => props.onSelect(file)}
      aria-label={`Comparar ${fileName(file)}`}
    />
    <span className="sr-only">Seleccionar para comparar</span>
  </label>
  const tags = (file: DentalAttachment) => {
    const list = options.catalog.tags.filter(item => file.archive?.tagIds.includes(item.id)); return <div className={styles.chips}>
      {list.slice(0, 2).map(item => <span className={styles.chip} key={item.id}>
        {item.name}
      </span>)}
      {list.length > 2 && <span className={styles.chip} title={list.slice(2).map(item => item.name).join(", ")}>+{list.length - 2}</span>}
      {file.archive?.archivedAt && <span className={styles.chip}>Archivado</span>}
    </div>
  }
  if (view === "gallery") return <div className={styles.gallery}>
    {files.map(file => <article
      className={styles.fileCard}
      key={file.id}
      data-file-id={file.id}
    >
      {checkbox(file)}
      <button
        type="button"
        className={styles.previewButton}
        aria-label={`Vista previa de ${fileName(file)}`}
        onClick={() => props.onPreview(file)}
      >
        <FileThumbnail patientId={patientId} file={file} />
      </button>
      <div className={styles.fileCardContent}>
        <div className={styles.fileCardTitle}>
          <button type="button" onClick={() => props.onPreview(file)}>
            {fileName(file)}
          </button>
          <FileActions {...props} file={file} />
        </div>
        <small>{fileTypeLabel(file)} · {formatLabel(file)} · {bytesLabel(file.size)}</small>
        <p>
          {date(file)}
        </p>
        {category(file)}
        {tags(file)}
      </div>
    </article>)}
  </div>
  return <div className={styles.fileTableWrap}>
    <table className={styles.fileTable}>
      <thead>
        <tr>
          <th>Archivo</th>
          <th>Tipo clínico</th>
          <th>Categoría</th>
          <th>Fecha de estudio</th>
          <th>Profesional</th>
          <th>Tamaño</th>
          <th>
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {files.map(file => <tr key={file.id} data-file-id={file.id}>
          <td data-label="Archivo">
            <div className={styles.fileCell}>
              {checkbox(file)}
              <button
                type="button"
                className={styles.listThumb}
                onClick={() => props.onPreview(file)}
                aria-label={`Vista previa de ${fileName(file)}`}
              >
                <FileThumbnail patientId={patientId} file={file} />
              </button>
              <div>
                <button
                  type="button"
                  className={styles.fileTitle}
                  onClick={() => props.onPreview(file)}
                >
                  {fileName(file)}
                </button>
                <small>
                  {formatLabel(file)}
                </small>
                {tags(file)}
              </div>
            </div>
          </td>
          <td data-label="Tipo clínico">
            {fileTypeLabel(file)}
          </td>
          <td data-label="Categoría">
            {category(file)}
          </td>
          <td data-label="Fecha de estudio">
            {date(file)}
          </td>
          <td data-label="Profesional">
            {options.professionals[file.archive?.professionalId ?? ""] || "Sin asignar"}
          </td>
          <td data-label="Tamaño">
            {bytesLabel(file.size)}
          </td>
          <td data-label="Acciones">
            <FileActions {...props} file={file} />
          </td>
        </tr>)}
      </tbody>
    </table>
  </div>
}
