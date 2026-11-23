import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { DataTableColumn } from "@/shared/components/data-table"
import { SearchInput } from "@/shared/components/search-input"
import { ResponsiveFilterBar } from "@/shared/components/responsive-filter-bar"
import { formatCurrency } from "@/shared/lib/number"
import type { FinancialPortfolioRow } from "../types/finance.types"

// Sin vencimientos, mora ni estado "Vencida": dependen del financiamiento de cada clínica (ítem 8 del backlog).
const statusLabels: Record<FinancialPortfolioRow["status"], string> = { al_dia: "Al día", parcial: "Parcial" }
const balanceLabels: Record<string, string> = { all: "Todos los saldos", pending: "Con pendiente" }
function PortfolioStatus({ row }: { row: FinancialPortfolioRow }) {
  return <Badge className="finance-status" data-state={row.status}>{statusLabels[row.status]}</Badge>
}
function PatientIdentity({ row }: { row: FinancialPortfolioRow }) {
  const initials = row.patientName.trim().split(/\s+/).slice(0, 2).map(name => name[0]).join("")
  return <span className="finance-patient"><Avatar aria-hidden="true"><AvatarFallback>{initials}</AvatarFallback></Avatar><span>{row.patientName}</span></span>
}
function Amount({ value, kind }: { value: number; kind: string }) {
  return <span className="finance-amount" data-kind={kind} data-positive={value > 0 || undefined}>{formatCurrency(value)}</span>
}
const columns: DataTableColumn<FinancialPortfolioRow>[] = [
  { key: "patientName", header: "Paciente", cell: row => <PatientIdentity row={row} /> },
  { key: "treatmentName", header: "Tratamiento", cell: row => row.treatmentName },
  ...(["total", "paid", "pending"] as const).map((key, index) => ({
    key, header: ["Total", "Pagado", "Pendiente"][index],
    cell: (row: FinancialPortfolioRow) => <Amount value={row[key]} kind={key} />,
  })),
  { key: "status", header: "Estado", cell: row => <PortfolioStatus row={row} /> },
]
const primaryColumns = columns.filter(column => ["total", "paid", "pending"].includes(column.key))

export function ActivePortfolio({ rows }: { rows: FinancialPortfolioRow[] }) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [balance, setBalance] = useState("all")
  const query = search.trim().toLocaleLowerCase()
  const filtered = rows.filter(row =>
    (!query || [row.patientName, row.treatmentName].join(" ").toLocaleLowerCase().includes(query)) &&
    (status === "all" || row.status === status) &&
    (balance === "all" || row.pending > 0))
  const count = Number(status !== "all") + Number(balance !== "all") + Number(Boolean(query))
  const clear = () => { setSearch(""); setStatus("all"); setBalance("all") }
  const filters = (prefix: string) => <div className="finance-filter-fields">
    <div><Label htmlFor={prefix + "PortfolioStatus"}>Estado</Label>
      <Select value={status} items={{ all: "Todos", ...statusLabels }} onValueChange={value => setStatus(value ?? "all")}>
        <SelectTrigger id={prefix + "PortfolioStatus"}><SelectValue /></SelectTrigger>
        <SelectContent alignItemWithTrigger={false}><SelectItem value="all">Todos</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div><Label htmlFor={prefix + "PortfolioBalance"}>Saldo</Label>
      <Select value={balance} items={balanceLabels} onValueChange={value => setBalance(value ?? "all")}>
        <SelectTrigger id={prefix + "PortfolioBalance"}><SelectValue /></SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>{Object.entries(balanceLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  </div>
  return <div data-slot="active-portfolio" className="@container/portfolio min-w-0">
    <div className="finance-portfolio-filters"><ResponsiveFilterBar
      search={<SearchInput ariaLabel="Buscar paciente o tratamiento" placeholder="Buscar paciente o tratamiento…" value={search} onChange={setSearch} />}
      desktopFilters={filters("desktop")} panelTitle="Filtros de cartera" activeFilterCount={count} onClear={clear}>
      {filters("mobile")}
    </ResponsiveFilterBar></div>
    {filtered.length === 0 ? <p className="finance-portfolio-empty" role="status">{rows.length ? "No hay registros que coincidan con los filtros." : "No hay registros en la cartera activa."}</p> : <>
    <div role="region" aria-label="Cartera activa, tabla desplazable horizontalmente" tabIndex={0} className="clinic-finance-table hidden min-w-0 overflow-x-auto px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @[59rem]/portfolio:block">
      <Table><TableHeader><TableRow>{columns.map(column => <TableHead key={column.key} data-column={column.key}>{column.header}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{filtered.map(row => <TableRow key={row.patientId + "-" + row.treatmentId}>{columns.map(column => <TableCell key={column.key} data-column={column.key}>{column.cell(row)}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>
    <ul aria-label="Registros de cartera activa" className="finance-portfolio-list @[59rem]/portfolio:hidden">
      {filtered.map(row => {
        const id = "portfolio-" + row.patientId + "-" + row.treatmentId
        return <li key={id}><article aria-labelledby={id}>
          <div className="finance-portfolio-heading"><h3 id={id}><PatientIdentity row={row} /></h3><PortfolioStatus row={row} /></div>
          <p className="finance-treatment-name">{row.treatmentName}</p>
          <dl className="finance-primary-amounts">{primaryColumns.map(column => <div key={column.key}><dt>{column.header}</dt><dd>{column.cell(row)}</dd></div>)}</dl>
        </article></li>
      })}
    </ul>
    </>}
    <p className="finance-portfolio-count" aria-live="polite">{filtered.length} de {rows.length} registros</p>
  </div>
}
