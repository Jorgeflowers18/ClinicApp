import { useState } from "react"
import { ArchiveRestore, Archive, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog"
import type { DentalAttachment } from "../../types/clinical-history.types"
import type { ArchiveCategory, ArchiveCatalog, ArchiveTag } from "../types"
import { archiveApi } from "../api"
import { publishCatalog } from "../hooks"
import { ArchiveSelect, IconAction } from "./controls"
import styles from "../archive.module.css"

export function CatalogDialog({ catalog, files, onClose }: { catalog: ArchiveCatalog; files: DentalAttachment[]; onClose: () => void }) {
  const [tab, setTab] = useState("categories"), [category, setCategory] = useState<Partial<ArchiveCategory> | null>(null), [tag, setTag] = useState<Partial<ArchiveTag> | null>(null)
  const [error, setError] = useState(""), [busy, setBusy] = useState(false)
  async function run(operation: () => Promise<ArchiveCatalog>) {
    setBusy(true); setError("")
    try { publishCatalog(await operation()); setCategory(null); setTag(null) } catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar") } finally { setBusy(false) }
  }
  return <Dialog open onOpenChange={open => !open && !busy && onClose()}>
    <DialogContent variant="medium" aria-busy={busy}>
      <DialogHeader>
        <DialogTitle>Categorías y etiquetas</DialogTitle>
        <DialogDescription>Catálogo compartido de la institución de demostración. Los recuentos corresponden únicamente al paciente actual.</DialogDescription>
      </DialogHeader>
      <DialogBody className={styles.catalog}>

        <div className={styles.segmented} aria-label="Catálogo">
          <Button variant={tab === "categories" ? "secondary" : "ghost"} onClick={() => { setTab("categories"); setTag(null) }}>Categorías</Button>
          <Button variant={tab === "tags" ? "secondary" : "ghost"} onClick={() => { setTab("tags"); setCategory(null) }}>Etiquetas</Button>
        </div>

        {tab === "categories" ? <>
          <Button variant="outline" onClick={() => setCategory({ name: "", description: "", color: "neutral", archivedAt: null })}><Plus />Nueva categoría</Button>
          <ul>
            {catalog.categories.map(item => <li key={item.id}>
              <div>
                <strong>
                  {item.name}
                </strong>
                <p>
                  {item.description}
                </p>
                <small>{files.filter(file => file.archive?.categoryId === item.id).length} archivos de este paciente{item.archivedAt ? " · Archivada" : ""}</small>
              </div>
              <IconAction
                label={`Editar categoría ${item.name}`}
                icon={Pencil}
                disabled={busy}
                onClick={() => setCategory(item)}
              />
              <IconAction
                label={`${item.archivedAt ? "Restaurar" : "Archivar"} categoría ${item.name}`}
                icon={item.archivedAt ? ArchiveRestore : Archive}
                disabled={busy}
                onClick={() => void run(() => archiveApi.category({ ...item, archivedAt: item.archivedAt ? null : new Date().toISOString() }))}
              />
            </li>)}
          </ul>
          {category && <form className={styles.editor} onSubmit={event => { event.preventDefault(); void run(() => archiveApi.category({ ...category, name: category.name ?? "", description: category.description ?? "", color: category.color ?? "neutral", archivedAt: category.archivedAt ?? null })) }}>
            <label>Nombre de categoría<Input
              required
              maxLength={60}
              value={category.name}
              onChange={event => setCategory({ ...category, name: event.target.value })}
            /></label>
            <label>Descripción opcional<Textarea
              maxLength={300}
              value={category.description}
              onChange={event => setCategory({ ...category, description: event.target.value })}
            /></label>
            <ArchiveSelect
              label="Color discreto"
              value={category.color ?? "neutral"}
              items={{ neutral: "Neutro", cyan: "Cian", violet: "Violeta", amber: "Ámbar", green: "Verde" }}
              onChange={color => setCategory({ ...category, color })}
            />
            <div className={styles.actions}>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setCategory(null)}
              >Cancelar edición</Button>
              <Button type="submit" disabled={busy}>Guardar categoría</Button>
            </div>
          </form>}
          <p className={styles.hint}>Archivar una categoría conserva sus archivos y asociaciones. Puedes reasignarlos desde Editar metadatos o dejarlos Sin categoría.</p>
        </> : <>
          <Button variant="outline" onClick={() => setTag({ name: "" })}><Plus />Nueva etiqueta</Button>
          <ul>
            {catalog.tags.map(item => <li key={item.id}>
              <div>
                <strong>
                  {item.name}
                </strong>
                <small>{files.filter(file => file.archive?.tagIds.includes(item.id)).length} archivos de este paciente</small>
              </div>
              <IconAction
                label={`Editar etiqueta ${item.name}`}
                icon={Pencil}
                disabled={busy}
                onClick={() => setTag(item)}
              />
            </li>)}
          </ul>
          {tag && <form className={styles.editor} onSubmit={event => { event.preventDefault(); void run(() => archiveApi.tag(tag.name ?? "", tag.id, tag.version)) }}>
            <label>Nombre de etiqueta<Input
              required
              maxLength={40}
              value={tag.name}
              onChange={event => setTag({ ...tag, name: event.target.value })}
            /></label>
            <div className={styles.actions}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTag(null)}
              >Cancelar edición</Button>
              <Button type="submit" disabled={busy}>Guardar etiqueta</Button>
            </div>
          </form>}
        </>}

        {error && <p role="alert">
          {error}
        </p>}

      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          disabled={busy}
          onClick={onClose}
        >Cerrar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
