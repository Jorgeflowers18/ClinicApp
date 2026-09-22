import { useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Download, FileText, Plus, Printer, Save } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { usePatient } from "@/modules/patients/api/patients.queries"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/shared/components/page-header"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { env } from "@/shared/lib/env"
import type { Patient } from "@/modules/patients/types/patient.types"
import { useDentalRecord } from "./use-dental-record"
import { OdontogramFrame, type ChartHandle } from "./odontogram-frame"
import { newVisit, type DentalVisit } from "./types"
import { ConsultationPanel, ConsentPanel, TreatmentPanel } from "./clinical-panels"
import { AttachmentsPanel } from "./attachments-panel"
import { downloadBlob, exportRecord, printVisit, visitDocument } from "./export"

export function DentalHistoryPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const { data: patient, isLoading, error } = usePatient(patientId)
  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (!patient || error) return <Alert><AlertTitle>No se pudo cargar el paciente</AlertTitle><AlertDescription>{getErrorMessage(error)}</AlertDescription></Alert>
  if (!env.useMockApi) return <Alert><AlertTitle>Módulo odontológico local</AlertTitle><AlertDescription>Configura el servicio odontológico del backend para utilizar este módulo con pacientes del servidor.</AlertDescription></Alert>
  return <DentalWorkspace key={patient.id} patient={patient} />
}

function DentalWorkspace({ patient }: { patient: Patient }) {
  const professional = useAuthStore((state) => state.user?.name ?? "")
  const { record, error, saving, updateDraft, commit } = useDentalRecord(patient.id, professional)
  const navigate = useNavigate()
  const chartHandle = useRef<ChartHandle | null>(null)
  const [chartReady, setChartReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState("odontograma")
  const patientName = `${patient.firstName} ${patient.lastName}`
  if (!record) return error ? <Alert><AlertTitle>No se pudo abrir la historia odontológica</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : <Skeleton className="h-96 w-full" />

  const visit = (selectedId ? record.visits.find((row) => row.id === selectedId) : record.draft) ?? record.visits.at(-1)
  if (!visit) return null
  const readOnly = Boolean(visit.savedAt)
  const update = (patch: Partial<DentalVisit>) => { if (!readOnly) updateDraft(patch) }
  const currentVisit = (): DentalVisit => {
    const chart = chartHandle.current?.snapshot() ?? visit.chart
    const caseData = chart?.payload.case
    return { ...visit, chart: chart ? { ...chart, payload: {
      ...chart.payload, case: { ...(caseData && typeof caseData === "object" ? caseData : {}),
        patientName, patientDob: patient.birthDate, examDate: visit.date },
    } } : null }
  }
  const saveVisit = async () => {
    if (!visit.date || !visit.professional.trim() || !visit.reason.trim() || !visit.diagnosis.trim()) {
      setTab("consulta"); toast.error("Completa fecha, profesional, motivo y diagnóstico antes de guardar la visita."); return
    }
    if (visit.nextVisit && visit.nextVisit < visit.date) { setTab("consulta"); toast.error("El próximo control debe ser posterior o igual a la consulta."); return }
    if (visit.consents.some((item) => !item.procedure.trim() || !item.information.trim() || (item.status !== "pendiente" && (!item.signer.trim() || !item.date)))) {
      setTab("consentimientos"); toast.error("Completa el procedimiento, la información y, si corresponde, el firmante y la fecha del consentimiento."); return
    }
    const snapshot = chartHandle.current?.snapshot()
    if (!snapshot) { toast.error("Espera a que el odontograma termine de cargar."); return }
    setBusy(true)
    try {
      const finalized = { ...currentVisit(), savedAt: new Date().toISOString() }
      await commit({ ...record, draft: null, visits: [...record.visits, finalized] })
      setSelectedId(finalized.id)
      toast.success("Visita guardada con odontograma y periodontograma")
    } catch (cause) { toast.error(getErrorMessage(cause)) }
    finally { setBusy(false) }
  }
  const startVisit = async () => {
    if (record.draft) { setSelectedId(null); return }
    setBusy(true)
    try {
      await commit({ ...record, draft: newVisit(professional, record.visits.at(-1)) })
      setSelectedId(null)
      setTab("consulta")
    } catch (cause) { toast.error(getErrorMessage(cause)) }
    finally { setBusy(false) }
  }

  return <div className="min-w-0 space-y-5">
    <div>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate(`/pacientes/${patient.id}`)}><ArrowLeft />Volver al paciente</Button>
      <PageHeader title="Historia clínica odontológica" description={`${patientName} · Cédula ${patient.documentId}`} actions={<div className="flex flex-wrap gap-2">
        {readOnly ? <Button onClick={() => void startVisit()} disabled={busy || uploading}><Plus />{record.draft ? "Continuar borrador" : "Nueva visita"}</Button> : <Button onClick={() => void saveVisit()} disabled={busy || uploading || !chartReady}><Save />{busy ? "Guardando…" : "Guardar visita"}</Button>}
      </div>} />
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{readOnly ? "Visita guardada · solo lectura" : "Visita en preparación"}</Badge><span>{formatDateOnly(visit.date)} · {visit.professional}</span></div>
      <span role="status" className="text-xs text-muted-foreground">{error ? "No se guardaron los últimos cambios" : saving ? "Guardando borrador…" : "Guardado local en este navegador"}</span>
    </div>
    {error && <Alert><AlertTitle>No se pudo guardar</AlertTitle><AlertDescription>{error} El borrador permanece en pantalla.</AlertDescription></Alert>}

    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Visitas registradas</p><p className="mt-1 text-xl font-semibold">{record.visits.length}</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Procedimientos de esta visita</p><p className="mt-1 text-xl font-semibold">{visit.plan.filter((item) => item.status === "realizado").length} / {visit.plan.length}</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Próximo control</p><p className="mt-1 text-xl font-semibold">{visit.nextVisit ? formatDateOnly(visit.nextVisit) : "Por definir"}</p></div>
    </div>

    <fieldset disabled={busy || uploading} className="min-w-0 space-y-4 border-0 p-0" style={{ pointerEvents: busy || uploading ? "none" : undefined }}>
    <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
      <div className="overflow-x-auto pb-2"><TabsList variant="line" className="gap-3">
        <TabsTrigger value="odontograma">Odontograma y periodontograma</TabsTrigger>
        <TabsTrigger value="consulta">Evolución y diagnóstico</TabsTrigger>
        <TabsTrigger value="plan">Plan de tratamiento</TabsTrigger>
        <TabsTrigger value="consentimientos">Consentimientos</TabsTrigger>
        <TabsTrigger value="archivos">Fotos y documentos</TabsTrigger>
        <TabsTrigger value="visitas">Seguimiento por visita</TabsTrigger>
      </TabsList></div>
      <TabsContent value="odontograma" keepMounted className="data-[hidden]:hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Selecciona una pieza para registrar hallazgos. Cambia a «Estado periodontal» dentro del editor para las mediciones por sitio.</p></div>
        <OdontogramFrame key={`${visit.id}-${readOnly}`} visit={visit} patientName={patientName} birthDate={patient.birthDate} readOnly={readOnly}
          handle={chartHandle} onReady={setChartReady} onChange={(chart) => { if (!readOnly) updateDraft({ chart }) }} />
      </TabsContent>
      <TabsContent value="consulta"><ConsultationPanel visit={visit} readOnly={readOnly} update={update} /></TabsContent>
      <TabsContent value="plan"><TreatmentPanel visit={visit} readOnly={readOnly} update={update} /></TabsContent>
      <TabsContent value="consentimientos"><ConsentPanel visit={visit} readOnly={readOnly} update={update} /></TabsContent>
      <TabsContent value="archivos"><AttachmentsPanel key={visit.id} patientId={patient.id} visit={visit} readOnly={readOnly} update={updateDraft} onUploading={setUploading} /></TabsContent>
      <TabsContent value="visitas"><Card><CardHeader><CardTitle>Evolución y salud periodontal por visita</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Cada visita conserva su odontograma, mediciones periodontales, plan y documentos. Las nuevas visitas parten del último estado registrado.</p>
        {record.draft && <Button variant="outline" onClick={() => { setSelectedId(null); setTab("consulta") }}>Continuar visita en preparación</Button>}
        {!record.visits.length && <p className="p-6 text-center text-muted-foreground">Guarda la primera visita para comenzar el seguimiento.</p>}
        {[...record.visits].reverse().map((item) => <article key={item.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-medium">{formatDateOnly(item.date)} · {item.reason}</h3><p className="text-xs text-muted-foreground">{item.professional}</p></div><Button variant="outline" onClick={() => { setSelectedId(item.id); setTab("odontograma") }}>Consultar visita</Button></div>
          <p className="text-sm"><strong>Diagnóstico: </strong>{item.diagnosis}</p>
          {item.evolution && <p className="whitespace-pre-wrap text-sm">{item.evolution}</p>}
          <p className="whitespace-pre-wrap text-sm text-muted-foreground"><strong>Registro periodontal: </strong>{item.chart?.summary.periodontalText || "Sin mediciones periodontales registradas."}</p>
          <p className="text-xs text-muted-foreground">{item.attachments.length} archivos · {item.plan.length} procedimientos en el plan</p>
        </article>)}
      </CardContent></Card></TabsContent>
    </Tabs>
    </fieldset>

    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><FileText className="size-4" />Exportar documentos clínicos</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!chartReady} onClick={() => { try { printVisit(currentVisit(), patientName, patient.documentId) } catch (cause) { toast.error(getErrorMessage(cause)) } }}><Printer />Imprimir / Guardar PDF</Button>
        <Button variant="outline" disabled={!chartReady} onClick={() => downloadBlob(new Blob([visitDocument(currentVisit(), patientName, patient.documentId)], { type: "text/html;charset=utf-8" }), `visita-${visit.date}.html`)}><Download />Documento de la visita</Button>
        <Button variant="outline" disabled={!chartReady} onClick={() => exportRecord({ ...record, draft: record.draft && !readOnly ? currentVisit() : record.draft }, patientName)}><Download />Historia completa JSON</Button>
      </div>
      <p className="text-xs text-muted-foreground">El editor incluye además PDF, imágenes, SVG y FHIR. Las fotos y los documentos originales se descargan desde su ficha. En esta versión local, los registros se guardan en este navegador y no se sincronizan con un servidor.</p>
    </CardContent></Card>
  </div>
}
