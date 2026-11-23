import { useId, useState } from "react"
import { Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { PatientClinicalHistory } from "../../types/clinical-history.types"
import type { ArchiveCatalog, ClinicalFileDraft } from "../types"
import { archiveApi } from "../api"
import { publishCatalog } from "../hooks"
import { clinicalFileTypes, archiveText } from "../lib/classification"
import { ArchiveSelect } from "./controls"
import styles from "../archive.module.css"

export interface MetadataOptions { history: PatientClinicalHistory; catalog: ArchiveCatalog; professionals: Record<string, string>; treatments: Record<string, string> }
export function MetadataFields({ value, onChange, options, part = "all", name = true }: { value: ClinicalFileDraft; onChange: (value: ClinicalFileDraft) => void; options: MetadataOptions; part?: "classification" | "additional" | "all"; name?: boolean }) {
  const id = useId(), [newCategory, setNewCategory] = useState(""), [newTag, setNewTag] = useState("")
  const [error, setError] = useState(""), [busy, setBusy] = useState(false)
  const set = <K extends keyof ClinicalFileDraft>(key: K, next: ClinicalFileDraft[K]) => onChange({ ...value, [key]: next })
  const { catalog, history } = options
  async function create(kind: "category" | "tag") {
    setBusy(true); setError("")
    try {
      const result = kind === "category" ? await archiveApi.category({ name: newCategory, description: "", color: "neutral", archivedAt: null }) : await archiveApi.tag(newTag)
      publishCatalog(result)
      if (kind === "category") { set("categoryId", result.categories.find(item => archiveText(item.name) === archiveText(newCategory))?.id ?? null); setNewCategory("") }
      else { const tag = result.tags.find(item => archiveText(item.name) === archiveText(newTag)); if (tag) set("tagIds", [...new Set([...value.tagIds, tag.id])]); setNewTag("") }
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar") }
    finally { setBusy(false) }
  }
  return <div className={styles.metadata}>

    {part !== "additional" && <>

      {name && <div className={`${styles.field} ${styles.full}`}>
        <label htmlFor={`${id}-name`}>Nombre del archivo</label>
        <Input
          id={`${id}-name`}
          required
          maxLength={200}
          value={value.displayName}
          onChange={event => set("displayName", event.target.value)}
        />
      </div>}

      <ArchiveSelect
        label="Tipo clínico"
        value={value.clinicalType || "none"}
        items={{ none: "Seleccionar tipo clínico", ...clinicalFileTypes }}
        onChange={next => set("clinicalType", next === "none" ? "" : next)}
      />

      <ArchiveSelect
        label="Categoría"
        value={value.categoryId ?? "none"}
        items={{ none: "Sin categoría", ...Object.fromEntries(catalog.categories.filter(item => !item.archivedAt || item.id === value.categoryId).map(item => [item.id, `${item.name}${item.archivedAt ? " (archivada)" : ""}`])) }}
        onChange={next => set("categoryId", next === "none" ? null : next)}
      />

      <div className={styles.field}>
        <label htmlFor={`${id}-date`}>Fecha de estudio</label>
        <Input
          id={`${id}-date`}
          aria-describedby={`${id}-date-help`}
          type="date"
          value={value.studyDate ?? ""}
          onChange={event => set("studyDate", event.target.value || null)}
        />
        <small id={`${id}-date-help`}>No se deduce de la fecha de carga.</small>
      </div>

      <ArchiveSelect
        label="Profesional"
        value={value.professionalId ?? "none"}
        items={{ none: "Sin profesional asociado", ...options.professionals }}
        onChange={next => set("professionalId", next === "none" ? null : next)}
      />

      <div className={styles.inlineCreate}>
        <Input
          aria-label="Nueva categoría"
          placeholder="Nueva categoría institucional"
          value={newCategory}
          maxLength={60}
          onChange={event => setNewCategory(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!newCategory.trim() || busy}
          onClick={() => void create("category")}
        ><Plus />Crear categoría</Button>
      </div>

      <small className={styles.full}>Las categorías y etiquetas se comparten en toda la institución. No cambian el tipo clínico.</small>

    </>}

    {part !== "classification" && <>

      <ArchiveSelect
        label="Atención vinculada"
        value={value.encounterId ?? "none"}
        items={{ none: "Sin atención vinculada", ...Object.fromEntries(history.encounters.map(item => [item.id, `${item.date} · ${item.reason || "Atención clínica"}`])) }}
        onChange={next => set("encounterId", next === "none" ? null : next)}
      />

      <ArchiveSelect
        label="Tratamiento vinculado"
        value={value.treatmentId ?? "none"}
        items={{ none: "Sin tratamiento vinculado", ...options.treatments }}
        onChange={next => set("treatmentId", next === "none" ? null : next)}
      />

      <ArchiveSelect
        label="Resultado de examen solicitado"
        value={value.examRequestId ?? "none"}
        items={{ none: "Sin examen vinculado", ...Object.fromEntries(history.record.examRequests.filter(item => item.status === "pendiente" || item.id === value.examRequestId).map(item => [item.id, `${clinicalFileTypes[item.kind]} · ${item.requestedAt}${item.detail ? ` · ${item.detail}` : ""}`])) }}
        onChange={next => set("examRequestId", next === "none" ? null : next)}
      />

      <div className={styles.field}>
        <label htmlFor={`${id}-zone`}>Zona o pieza dental</label>
        <Input
          id={`${id}-zone`}
          maxLength={150}
          value={value.zone}
          onChange={event => set("zone", event.target.value)}
        />
      </div>

      <fieldset className={styles.full}>
        <legend>Etiquetas</legend>
        <div className={styles.chips}>
          {catalog.tags.map(tag => <button
            className={styles.chip}
            type="button"
            aria-pressed={value.tagIds.includes(tag.id)}
            key={tag.id}
            onClick={() => set("tagIds", value.tagIds.includes(tag.id) ? value.tagIds.filter(id => id !== tag.id) : [...value.tagIds, tag.id])}
          >
            {tag.name}
          </button>)}
          {!catalog.tags.length && <small>No hay etiquetas creadas.</small>}
        </div>
        <div className={styles.inlineCreate}>
          <Input
            aria-label="Nueva etiqueta"
            placeholder="Crear o reutilizar etiqueta"
            maxLength={40}
            value={newTag}
            onChange={event => setNewTag(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!newTag.trim() || busy}
            onClick={() => void create("tag")}
          ><Plus />Agregar etiqueta</Button>
        </div>
      </fieldset>

      <div className={`${styles.field} ${styles.full}`}>
        <label htmlFor={`${id}-notes`}>Notas clínicas del archivo</label>
        <Textarea
          id={`${id}-notes`}
          rows={3}
          maxLength={3000}
          value={value.notes}
          onChange={event => set("notes", event.target.value)}
        />
      </div>

    </>}

    {error && <p className={styles.full} role="alert">
      {error}
    </p>}

  </div>
}
