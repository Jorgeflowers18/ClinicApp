import { useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQueries } from "@tanstack/react-query"
import { ArrowLeft, Banknote, Clock, FileText, Package, Pencil, Wallet } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { formatDateOnly } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { patientsApi } from "@/modules/patients/api/patients.api"
import { patientsKeys } from "@/modules/patients/api/patients.queries"
import { useTreatmentPortfolio } from "@/modules/finance/api/finance.queries"
import { useTreatment, useTreatmentAssignments } from "../api/treatments.queries"
import { useTreatmentInventory } from "../hooks/use-treatment-options"
import { TreatmentFormDialog } from "../components/treatment-form-dialog"
import { TreatmentSessionProgress } from "../components/treatment-session-progress"
import { TreatmentStatus } from "../components/treatment-status"
import { assignmentPrice, type TreatmentAssignment } from "../types/treatment.types"
import "../treatments.css"

function displaySupplyUnit(unit: string, quantity: number) {
  const forms = [["unidad", "unidades"], ["caja", "cajas"], ["jeringa", "jeringas"], ["litro", "litros"]]
  const pair = forms.find(values => values.includes(unit.trim().toLowerCase()))
  return pair ? pair[quantity === 1 ? 0 : 1] : unit
}

export function TreatmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const treatmentQuery = useTreatment(id)
  const { data: treatment } = treatmentQuery
  const assignments = useTreatmentAssignments(id)
  const inventory = useTreatmentInventory()
  // Montos solo para admin y recepción (el médico recibe 403): la suma de la cartera de todos sus pacientes.
  const canSeeFinance = useAuthStore(state => state.user?.role === "admin" || state.user?.role === "recepcion")
  const financial = useTreatmentPortfolio(id, { enabled: canSeeFinance })
  const [editing, setEditing] = useState(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const canOpenHistory = useAuthStore(state => state.user?.role === "admin" || state.user?.role === "medico")
  const received = [...(assignments.data ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate))
  const patientIds = [...new Set(received.map(item => item.patientId))]
  const patients = useQueries({ queries: patientIds.map(patientId => ({ queryKey: patientsKeys.detail(patientId), queryFn: () => patientsApi.get(patientId) })) })

  if(treatmentQuery.isPending) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-48 w-full" /></div>
  if(!treatment) return <Alert variant="destructive"><AlertTitle>No se pudo cargar el tratamiento</AlertTitle><AlertDescription>{getErrorMessage(treatmentQuery.error)}</AlertDescription></Alert>

  const columns: DataTableColumn<TreatmentAssignment>[] = [
    {
      key: "patient", header: "Paciente", cell: row => {
        const query = patients[patientIds.indexOf(row.patientId)], patient = query?.data
        const name = patient ? patient.firstName + " " + patient.lastName : query?.isPending ? "Cargando paciente…" : "Paciente no disponible"
        const initials = patient ? ((patient.firstName[0] ?? "") + (patient.lastName[0] ?? "")).toUpperCase() : "?"
        return <div className="treatment-recipient"><Avatar size="sm" aria-hidden="true"><AvatarFallback>{initials}</AvatarFallback></Avatar><span className="font-medium">{name}</span></div>
      }
    },
    { key: "date", header: "Fecha", cell: row => formatDateOnly(row.startDate, { day: "2-digit", month: "short", year: "numeric" }) },
    { key: "tooth", header: "Pieza / zona", cell: row => row.tooth || "General" },
    { key: "cost", header: "Costo", className: "text-right", cell: row => formatCurrency(assignmentPrice(row, treatment.price)) },
    { key: "status", header: "Estado", cell: row => <TreatmentSessionProgress assignment={row} /> },
    ...(canOpenHistory ? [{
      key: "encounter", header: "Atención", cell: (row: TreatmentAssignment) => row.sourceEncounterId
        ? <Link className="text-sm font-medium hover:underline" to={"/historial-clinico/paciente/" + row.patientId + "?atencion=" + row.sourceEncounterId}>Ver atención</Link>
        : <span className="text-muted-foreground">—</span>
    }] : []),
  ]

  const summary = financial.data
  const amounts = summary ? [
    { label: "Valor realizado", value: summary.total },
    { label: "Pagado", value: summary.paid, tone: "paid" },
    { label: "Pendiente", value: summary.pending, tone: summary.pending > 0 ? "pending" : undefined },
  ] : []

  return <div className="treatment-detail">
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate("/tratamientos")} className="treatment-detail-back"><ArrowLeft />Volver a tratamientos</Button>
      <PageHeader title={treatment.name} actions={<div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate("/finanzas")}><Wallet />Ver finanzas</Button>
        <Button onClick={event => { returnFocus.current = event.currentTarget; setEditing(true) }}><Pencil />Editar</Button>
      </div>} />
      <div className="treatment-detail-identity"><span>{treatment.category}</span><TreatmentStatus active={treatment.active} /></div>
    </div>
    <dl className="treatment-overview">
      <div><Clock aria-hidden="true" /><div><dt>Duración estimada</dt><dd>{treatment.durationMinutes} min</dd></div></div>
      <div><Banknote aria-hidden="true" /><div><dt>Precio del catálogo</dt><dd>{formatCurrency(treatment.price)}</dd></div></div>
    </dl>
    <Card className="treatment-information">
      <section aria-labelledby="treatment-description-heading">
        <h2 id="treatment-description-heading"><FileText aria-hidden="true" />Descripción</h2>
        <p className="treatment-description">{treatment.description || "Sin descripción registrada."}</p>
      </section>
      <section aria-labelledby="treatment-supplies-heading">
        <h2 id="treatment-supplies-heading"><Package aria-hidden="true" />Insumos por sesión</h2>
        {treatment.consumption.length === 0 ? <p className="treatment-empty">Este tratamiento no consume insumos de inventario.</p>
          : inventory.isPending ? <Skeleton className="h-16 w-full" />
            : inventory.isError ? <Alert variant="destructive"><AlertTitle>No se pudieron cargar los insumos</AlertTitle><AlertDescription>{getErrorMessage(inventory.error)}</AlertDescription></Alert>
              : <ul className="treatment-supply-list" role="list">
                {treatment.consumption.map((entry, index) => {
                  const item = inventory.data?.find(item => item.id === entry.itemId)
                  return <li key={entry.itemId + "-" + index}><span>{item?.name ?? "Insumo no disponible"}</span><span className="treatment-supply-quantity">{entry.quantity}{item?.unit && " " + displaySupplyUnit(item.unit, entry.quantity)}</span></li>
                })}
              </ul>}
      </section>
    </Card>
    {canSeeFinance && <Card><CardHeader><CardTitle>Resumen financiero</CardTitle><CardDescription>De todos los pacientes que lo recibieron.</CardDescription></CardHeader><CardContent>
      {financial.isPending ? <Skeleton className="h-16 w-full" />
        : financial.isError ? <Alert variant="destructive"><AlertTitle>No se pudo cargar el resumen financiero</AlertTitle><AlertDescription>{getErrorMessage(financial.error)}</AlertDescription></Alert>
          : summary?.patients ? <dl className="treatment-financial-values">{amounts.map(amount => <div key={amount.label} data-tone={amount.tone}><dt>{amount.label}</dt><dd>{formatCurrency(amount.value)}</dd></div>)}</dl>
            : <p className="treatment-empty">Sin información financiera disponible.</p>}
    </CardContent></Card>}
    <Card><CardHeader><CardTitle>Pacientes que recibieron este tratamiento</CardTitle><CardDescription>Los tratamientos se registran desde la atención en la historia clínica del paciente.</CardDescription></CardHeader><CardContent>
        <DataTable className={"treatment-recipients" + (!assignments.isPending && !assignments.isError && received.length === 0 ? " treatment-empty-table" : "")} columns={columns} mobileTitleKey="patient" data={received} getRowId={row => row.id}
        isLoading={assignments.isPending} isError={assignments.isError} errorMessage={getErrorMessage(assignments.error)}
        emptyTitle="Sin pacientes asociados" emptyDescription="Ningún paciente ha recibido este tratamiento todavía." />
    </CardContent></Card>
    {editing && <TreatmentFormDialog treatmentId={treatment.id} returnFocus={() => returnFocus.current} onClose={() => setEditing(false)} />}
  </div>
}
