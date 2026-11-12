// Fixture aislada: no es una ruta ni una entrada del build de ClinicApp.
import { useState } from "react"
import { createRoot } from "react-dom/client"
import { PaginationBar } from "../../src/shared/components/pagination-bar"
import "../../src/index.css"

const query = new URLSearchParams(location.search)
if (query.get("theme") === "dark") document.documentElement.classList.add("dark")

export function PaginationFixture() {
  const [count, setCount] = useState(Number(query.get("rows") ?? 30))
  const [page, setPage] = useState(Number(query.get("page") ?? 1))
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState("")
  const [submits, setSubmits] = useState(0)
  const rows = Array.from({ length: Math.max(0, count) }, (_, index) => `Registro ${index + 1}`)
    .filter((row) => row.toLowerCase().includes(search.toLowerCase()))

  return (
    <main className="clinic-app-canvas space-y-5 p-4">
      <h1>Prueba aislada de paginación</h1>
      <label>Registros<input type="number" aria-label="Registros" value={count} onChange={(event) => setCount(Number(event.target.value))} /></label>
      <label>Tamaño de página<select aria-label="Tamaño de página" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[5, 10, 30].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      <label>Búsqueda<input aria-label="Búsqueda" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
      <form onSubmit={(event) => { event.preventDefault(); setSubmits((value) => value + 1) }}>
        {rows.length ? <ul>{rows.slice((page - 1) * pageSize, page * pageSize).map((row) => <li key={row}>{row}</li>)}</ul> : <p>Sin resultados</p>}
        <PaginationBar page={page} pageSize={pageSize} totalItems={rows.length} totalPages={999} onPageChange={setPage} />
      </form>
      <output aria-label="Página activa">{page}</output>
      <output aria-label="Envíos involuntarios">{submits}</output>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<PaginationFixture />)
