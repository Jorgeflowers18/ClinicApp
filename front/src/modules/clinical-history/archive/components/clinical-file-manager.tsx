import { useMemo, useState } from "react"
import { FolderOpen, FolderCog, Upload, LayoutGrid, List, Images, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { formatDateOnly, formatDateTime } from "@/shared/lib/date"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { usePatient } from "@/modules/patients/api/patients.queries"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { usePatientAssignments } from "@/modules/treatments/api/treatments.queries"
import { useClinicalHistory } from "../../api/clinical-history.queries"
import type { DentalAttachment } from "../../types/clinical-history.types"
import { archiveApi } from "../api"
import { useArchiveCatalog, useArchiveWrite } from "../hooks"
import { emptyArchiveCatalog } from "../types"
import { fileCategory, fileName, fileVersion, fileClinicalType, isClinicalImage, isImagingStudy } from "../lib/classification"
import { emptyFilters, selectClinicalFiles, type ArchiveFilters } from "../lib/filter"
import { ArchiveToolbar } from "./toolbar"
import { IconAction } from "./controls"
import { FileResults } from "./file-results"
import { FileViewer } from "./file-viewer"
import { CompareViewer } from "./compare-viewer"
import { downloadOriginal, comparisonCompatible } from "../lib/viewer"
import { CatalogDialog } from "./catalog-dialog"
import { UploadDialog } from "./upload-dialog"
import { EditFileDialog } from "./edit-dialog"
import styles from "../archive.module.css"

/** Patient key isolates every selection, modal and filter when navigating between records. */
export function ClinicalFileManager({ patientId }: { patientId: string }) {
  const user = useAuthStore(state => state.user)
  if (!user || !["admin", "medico"].includes(user.role)) return <p role="alert">El archivo clínico requiere un perfil clínico autorizado.</p>
  return <PatientArchive key={`${patientId}:${user.id}`} patientId={patientId} />
}
function PatientArchive({ patientId }: { patientId: string }) {
  const history = useClinicalHistory(patientId), patient = usePatient(patientId), catalogQuery = useArchiveCatalog(), professionalsQuery = useProfessionals(), assignments = usePatientAssignments(patientId)
  const [filters, setFilters] = useState(emptyFilters), [page, setPage] = useState(1), [selected, setSelected] = useState<string[]>([]), [view, setView] = useState(() => { try { return localStorage.getItem("clinicapp.archive-view") === "list" ? "list" : "gallery" } catch { return "gallery" } })
  const [upload, setUpload] = useState(false), [catalogOpen, setCatalogOpen] = useState(false), [edit, setEdit] = useState<DentalAttachment | null>(null), [viewer, setViewer] = useState<{ id: string; fullscreen?: boolean } | null>(null), [compare, setCompare] = useState(false), [confirm, setConfirm] = useState<DentalAttachment | null>(null), [error, setError] = useState("")
  const write = useArchiveWrite(patientId)
  const files = history.data?.record.patientId === patientId ? history.data.record.attachments : []
  const catalog = catalogQuery.data ?? emptyArchiveCatalog()
  const professionals = useMemo(() => Object.fromEntries((professionalsQuery.data ?? []).map(item => [item.id, item.name])), [professionalsQuery.data])
  const treatments = useMemo(() => Object.fromEntries((assignments.data ?? []).filter(item => item.patientId === patientId).map(item => [item.id, `${item.treatmentName || "Tratamiento registrado"} · ${item.startDate}`])), [assignments.data, patientId])
  const filtered = selectClinicalFiles(files, filters, catalog, professionals)
  const selectedFiles = filtered.filter(file => selected.includes(file.id))
  const lastPage = Math.max(1, Math.ceil(filtered.length / 24)), currentPage = Math.min(page, lastPage), visible = filtered.slice((currentPage - 1) * 24, currentPage * 24)
  const groups = new Map<string, DentalAttachment[]>()
  for (const file of visible) {
    const meta = file.archive
    const label = filters.group === "date" ? meta?.studyDate ? formatDateOnly(meta.studyDate) : "Sin fecha de estudio" : filters.group === "month" ? meta?.studyDate ? formatDateOnly(meta.studyDate, { month: "long", year: "numeric" }) : "Sin fecha de estudio" : filters.group === "category" ? fileCategory(file, catalog)?.name ?? "Sin categoría" : filters.group === "treatment" ? treatments[meta?.treatmentId ?? ""] ?? "Sin tratamiento vinculado" : ""
    groups.set(label, [...groups.get(label) ?? [], file])
  }
  function changeFilters(value: ArchiveFilters) { setFilters(value); setPage(1); setSelected([]); setCompare(false); setViewer(null) }
  function changeView(value: string) { setView(value); try { localStorage.setItem("clinicapp.archive-view", value) } catch { /* Non-sensitive preference is optional. */ } }
  function select(file: DentalAttachment) {
    setError("")
    if (selected.includes(file.id)) { setSelected(current => current.filter(id => id !== file.id)); return }
    if (selectedFiles.length && fileClinicalType(selectedFiles[0]) !== fileClinicalType(file)) { setError("Selecciona dos imágenes del mismo tipo clínico para comparar."); return }
    if (selectedFiles.length < 2 && isClinicalImage(file)) setSelected([...selectedFiles.map(item => item.id), file.id])
  }
  async function run(operation: () => Promise<unknown>) { setError(""); try { await operation() } catch (error) { setError(error instanceof Error ? error.message : "No se pudo completar la operación") } }
  if (history.isPending || patient.isPending || catalogQuery.isPending) return <div className={styles.root} aria-busy="true">
    <p role="status">Cargando archivo clínico…</p>
    <Skeleton className="h-16 w-full" />
    <Skeleton className="h-48 w-full" />
  </div>
  if (history.isError || patient.isError || catalogQuery.isError || !history.data || !patient.data || history.data.record.patientId !== patientId) return <div className={styles.error} role="alert">
    <p>No se pudo cargar el archivo clínico del paciente.</p>
    <Button variant="outline" onClick={() => { void history.refetch(); void patient.refetch(); void catalogQuery.refetch() }}>Reintentar</Button>
  </div>
  const patientName = `${patient.data.firstName} ${patient.data.lastName}`, options = { history: history.data, catalog, professionals, treatments }
  const active = files.filter(file => !file.archive?.archivedAt), last = [...files].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return <section
    className={styles.root}
    aria-label="Archivo clínico"
    data-patient-id={patientId}
  >

    <header className={styles.header}>
      <div>
        <h2><FolderOpen aria-hidden="true" />Archivo clínico</h2>
        <p>Imágenes, estudios y documentos del paciente</p>
      </div>
      <div className={styles.actions}>
        <Button
          variant="outline"
          onClick={() => setCatalogOpen(true)}
        ><FolderCog />Categorías</Button>
        <Button onClick={() => setUpload(true)}><Upload />Adjuntar archivos</Button>
      </div>
    </header>


    <dl className={styles.metrics}>
      <div>
        <dt>Archivos activos</dt>
        <dd>
          {active.length}
        </dd>
      </div>
      <div>
        <dt>Fotos clínicas</dt>
        <dd>
          {active.filter(file => fileClinicalType(file) === "fotografias").length}
        </dd>
      </div>
      <div>
        <dt>Estudios de imagen</dt>
        <dd>
          {active.filter(isImagingStudy).length}
        </dd>
      </div>
      <div>
        <dt>Documentos</dt>
        <dd>
          {active.filter(file => fileClinicalType(file) !== "fotografias" && !isImagingStudy(file)).length}
        </dd>
      </div>
      <div>
        <dt>Último registro</dt>
        <dd>
          {last ? formatDateTime(last.createdAt, { day: "numeric", month: "short", year: "numeric" }) : "Sin registros"}
        </dd>
      </div>
    </dl>

    <ArchiveToolbar
      filters={filters}
      onChange={changeFilters}
      catalog={catalog}
      professionals={professionals}
      treatments={treatments}
    />

    {(professionalsQuery.isError || assignments.isError) && <p role="alert" className={styles.hint}>No se pudieron cargar algunos vínculos. Los archivos se conservan.<Button
      size="sm"
      variant="ghost"
      onClick={() => { void professionalsQuery.refetch(); void assignments.refetch() }}
    >Reintentar vínculos</Button></p>}

    <div className={styles.resultsHeading}>
      <p>
        {filtered.length}
        {filtered.length === 1 ? "archivo" : "archivos"}
        {files.some(file => file.archive?.archivedAt) && filters.status === "active" ? " activos" : ""}
      </p>
      <div className={styles.segmented} aria-label="Vista de archivos">
        <IconAction
          label="Vista de lista"
          icon={List}
          pressed={view === "list"}
          onClick={() => changeView("list")}
        />
        <IconAction
          label="Vista de galería"
          icon={LayoutGrid}
          pressed={view === "gallery"}
          onClick={() => changeView("gallery")}
        />
      </div>
    </div>

    {selectedFiles.length > 0 && <div className={styles.selection} role="status">
      <span>{selectedFiles.length} de 2 imágenes seleccionadas</span>
      <Button
        size="sm"
        disabled={!comparisonCompatible(selectedFiles)}
        onClick={() => setCompare(true)}
      ><Images />Comparar</Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setSelected([])}
      >Cancelar selección</Button>
    </div>}

    {error && <p className={styles.error} role="alert">
      {error}
    </p>}

    {filtered.length ? [...groups].map(([label, group]) => <section key={label}>
      {label && <h3 className={styles.groupHeading}>
        {label}
      </h3>}
      <FileResults
        patientId={patientId}
        files={group}
        view={view}
        selected={selectedFiles.map(file => file.id)}
        options={options}
        writable
        onSelect={select}
        onPreview={(file, fullscreen) => setViewer({ id: file.id, fullscreen })}
        onEdit={setEdit}
        onArchive={setConfirm}
        onDownload={file => void run(() => downloadOriginal(patientId, file))}
      />
    </section>) : <div className={styles.empty}>
      <FolderOpen aria-hidden="true" />
      <h3>
        {files.length ? "No hay archivos que coincidan con los filtros." : "Todavía no hay archivos en la historia del paciente."}
      </h3>
      <p>
        {files.length ? "Revisa los filtros o consulta los archivos archivados." : "Adjunta una fotografía, un estudio o un documento para comenzar."}
      </p>
    </div>}

    {filtered.length > 24 && <nav className={styles.pagination} aria-label="Paginación de archivos">
      <span>{(currentPage - 1) * 24 + 1}–{Math.min(currentPage * 24, filtered.length)} de {filtered.length}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={currentPage <= 1}
        onClick={() => setPage(currentPage - 1)}
      ><ChevronLeft />Anterior</Button>
      <span>Página {currentPage} de {lastPage}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={currentPage >= lastPage}
        onClick={() => setPage(currentPage + 1)}
      >Siguiente<ChevronRight /></Button>
    </nav>}

    {upload && <UploadDialog
      patientId={patientId}
      patientName={patientName}
      recordNumber={patient.data.clinicalRecordNumber}
      options={options}
      onClose={() => setUpload(false)}
    />}

    {catalogOpen && <CatalogDialog
      catalog={catalog}
      files={files}
      onClose={() => setCatalogOpen(false)}
    />}

    {edit && <EditFileDialog
      patientId={patientId}
      patientName={patientName}
      file={edit}
      options={options}
      onClose={() => setEdit(null)}
    />}

    {viewer && <FileViewer
      patientId={patientId}
      patientName={patientName}
      files={filtered}
      fileId={viewer.id}
      onFile={id => setViewer(current => current ? { ...current, id } : { id })}
      fullscreen={viewer.fullscreen}
      options={options}
      onClose={() => setViewer(null)}
    />}

    {compare && comparisonCompatible(selectedFiles) && <CompareViewer
      patientId={patientId}
      patientName={patientName}
      files={selectedFiles as [DentalAttachment, DentalAttachment]}
      options={options}
      onClose={() => setCompare(false)}
    />}

    <ConfirmDialog
      open={Boolean(confirm)}
      onOpenChange={open => !open && !write.isPending && setConfirm(null)}
      title={confirm?.archive?.archivedAt ? "Restaurar archivo clínico" : "Archivar archivo clínico"}
      description={`«${confirm ? fileName(confirm) : ""}». Se conservarán el original, los consentimientos y los vínculos clínicos. ${confirm?.archive?.archivedAt ? "Volverá a aparecer entre los archivos activos." : "Podrás consultarlo y restaurarlo con el filtro Archivados."}`}
      confirmLabel={confirm?.archive?.archivedAt ? "Restaurar archivo" : "Archivar archivo"}
      isLoading={write.isPending}
      onConfirm={() => { if (confirm) void run(async () => { await write.mutateAsync(() => archiveApi.archive(patientId, confirm.id, fileVersion(confirm), !confirm.archive?.archivedAt)); setSelected([]); setConfirm(null) }) }}
    />

  </section>
}
