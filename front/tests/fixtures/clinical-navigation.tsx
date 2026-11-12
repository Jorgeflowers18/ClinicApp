// Fixture de Playwright: no forma parte de las entradas de producción de Vite ni de las rutas de ClinicApp.
import { useId, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { Button } from "../../src/components/ui/button"
import { ClinicalNavigation, ClinicalNavigationFooter } from "../../src/modules/clinical-history/components/clinical-navigation"
import styles from "../../src/modules/clinical-history/components/clinical-navigation.module.css"
import { useNavigationPlacement, useSectionNavigation, type NavigationSection } from "../../src/modules/clinical-history/hooks/use-section-navigation"
import { additionalRecordSections, recordSections } from "../../src/modules/clinical-history/lib/record-sections"
import "../../src/index.css"

const query = new URLSearchParams(location.search)
if (query.get("theme") === "dark") document.documentElement.classList.add("dark")
const fixtureSections: readonly NavigationSection<string>[] = [...recordSections, { value: "fixture-extra", label: "Sección de prueba" }]
const total = Math.min(fixtureSections.length, Math.max(0, Number(query.get("total") ?? 3)))
const initialItems = fixtureSections.slice(0, total)
const additional = query.get("additional") === "1" ? additionalRecordSections : []
const initialIndex = Math.min(Math.max(0, Number(query.get("active") ?? 1) - 1), total - 1)

export function NavigationFixture() {
  const container = useRef<HTMLDivElement>(null)
  const headingId = useId()
  const [items, setItems] = useState<readonly NavigationSection<string>[]>(initialItems)
  const [value, setValue] = useState(initialItems[initialIndex]?.value ?? "datos")
  const [draft, setDraft] = useState("")
  const [saved, setSaved] = useState("")
  const [saves, setSaves] = useState(0)
  const navigation = useSectionNavigation(items, value, setValue, additional)
  const controlsInHeader = useNavigationPlacement(container)

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4">
      <h1 className="text-lg font-semibold">Prueba aislada de navegación clínica</h1>
      <div className="flex flex-wrap gap-3">
        <label>
          Cantidad disponible
          <select aria-label="Cantidad disponible" value={items.length} onChange={(event) => setItems(fixtureSections.slice(0, Number(event.target.value)))}>
            {Array.from({ length: fixtureSections.length + 1 }, (_, count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" onClick={() => setItems((current) => current.filter((item) => item.value !== value))}>Quitar sección activa</Button>
        <Button type="button" variant="outline" onClick={() => setItems((current) => [...current].reverse())}>Invertir orden</Button>
        <Button type="button" variant="outline" onClick={() => setItems([recordSections[1], recordSections[3]])}>Solo segunda y cuarta disponibles</Button>
        <Button type="button" variant="outline" onClick={() => document.documentElement.classList.toggle("dark")}>Cambiar tema de la prueba</Button>
      </div>

      <div ref={container} className={styles.scope}>
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); setSaved(draft); setSaves((count) => count + 1) }}>
          <ClinicalNavigation navigation={navigation} controlsInHeader={controlsInHeader} headingId={headingId} />
          <section aria-labelledby={headingId} className="space-y-4 rounded-xl border bg-card p-4">
            <p>Identificador activo: <output aria-label="Identificador activo">{value}</output></p>
            <label className="block">Dato de prueba<input className="block w-full rounded-md border p-2" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
            <Button type="submit">Guardar cambios</Button>
            <p>Guardados: <output aria-label="Número de guardados">{saves}</output></p>
            <p>Valor guardado: <output aria-label="Valor guardado">{saved}</output></p>
          </section>
          <ClinicalNavigationFooter navigation={navigation} controlsInHeader={controlsInHeader} />
        </form>
      </div>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<NavigationFixture />)
