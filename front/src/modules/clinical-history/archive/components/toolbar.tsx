import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResponsiveFilterBar } from "@/shared/components/responsive-filter-bar"
import { SearchInput } from "@/shared/components/search-input"
import type { ArchiveCatalog } from "../types"
import { clinicalFileTypes } from "../lib/classification"
import { datePresets, emptyFilters, type ArchiveFilters } from "../lib/filter"
import { ArchiveSelect } from "./controls"
import styles from "../archive.module.css"

export function ArchiveToolbar({ filters, onChange, catalog, professionals, treatments }: { filters: ArchiveFilters; onChange: (value: ArchiveFilters) => void; catalog: ArchiveCatalog; professionals: Record<string, string>; treatments: Record<string, string> }) {
  const [more, setMore] = useState(false)
  const set = (key: keyof ArchiveFilters, value: string) => onChange({ ...filters, [key]: value })
  const count = Object.entries(emptyFilters()).filter(([key, value]) => filters[key as keyof ArchiveFilters] !== value).length
  const primary = <>
    <ArchiveSelect
      label="Tipo clínico"
      value={filters.type}
      items={{ all: "Todos los tipos", ...clinicalFileTypes }}
      onChange={value => set("type", value)}
    />
    <ArchiveSelect
      label="Categoría"
      value={filters.category}
      items={{ all: "Todas las categorías", none: "Sin categoría", ...Object.fromEntries(catalog.categories.map(item => [item.id, item.name + (item.archivedAt ? " (archivada)" : "")])) }}
      onChange={value => set("category", value)}
    />
    <ArchiveSelect
      label="Fecha de estudio"
      value={filters.date}
      items={datePresets}
      onChange={value => set("date", value)}
    />
  </>
  const dates = filters.date === "custom" && <>
    <label>Desde<Input
      type="date"
      value={filters.from}
      onChange={event => set("from", event.target.value)}
    /></label>
    <label>Hasta<Input
      type="date"
      value={filters.to}
      min={filters.from || undefined}
      onChange={event => set("to", event.target.value)}
    /></label>
    {filters.from && filters.to && filters.from > filters.to && <p role="alert">La fecha final debe ser igual o posterior a la inicial.</p>}
  </>
  const secondary = <>
    <ArchiveSelect
      label="Profesional"
      value={filters.professional}
      items={{ all: "Todos los profesionales", ...professionals }}
      onChange={value => set("professional", value)}
    />
    <ArchiveSelect
      label="Etiqueta"
      value={filters.tag}
      items={{ all: "Todas las etiquetas", ...Object.fromEntries(catalog.tags.map(item => [item.id, item.name])) }}
      onChange={value => set("tag", value)}
    />
    <ArchiveSelect
      label="Tratamiento"
      value={filters.treatment}
      items={{ all: "Todos los tratamientos", ...treatments }}
      onChange={value => set("treatment", value)}
    />
    <ArchiveSelect
      label="Estado del archivo"
      value={filters.status}
      items={{ active: "Activos", archived: "Archivados", all: "Todos los estados" }}
      onChange={value => set("status", value)}
    />
    <ArchiveSelect
      label="Ordenar por"
      value={filters.order}
      items={{ recent: "Más recientes", oldest: "Más antiguos", az: "Nombre: A a Z", za: "Nombre: Z a A" }}
      onChange={value => set("order", value)}
    />
    <ArchiveSelect
      label="Agrupar por"
      value={filters.group}
      items={{ none: "Sin agrupar", date: "Fecha de estudio", month: "Mes de estudio", category: "Categoría", treatment: "Tratamiento" }}
      onChange={value => set("group", value)}
    />
  </>
  return <div className={styles.toolbar}>
    <ResponsiveFilterBar
      wide
      search={<SearchInput
        className="max-w-none"
        value={filters.search}
        ariaLabel="Buscar archivos clínicos"
        placeholder="Buscar archivos clínicos..."
        onChange={value => set("search", value)}
      />}
      desktopFilters={<>
        {primary}
        <Button
          variant="outline"
          aria-expanded={more}
          onClick={() => setMore(!more)}
        ><SlidersHorizontal />Más filtros</Button>
      </>}
      panelTitle="Filtros del archivo clínico"
      activeFilterCount={count}
      onClear={() => onChange(emptyFilters())}
    >
      <div className={styles.filterGrid}>
        {primary}
        {dates}
        {secondary}
      </div>
    </ResponsiveFilterBar>
    <div className={styles.desktopExtra}>
      {(more || filters.date === "custom") && <div className={styles.filterGrid}>
        {dates}
        {more && secondary}
      </div>}
    </div>
  </div>
}
