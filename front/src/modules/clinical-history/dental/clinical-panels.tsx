import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { treatmentLabels, type DentalVisit, type TreatmentStage } from "./types"

type Props = { visit: DentalVisit; readOnly: boolean; update: (patch: Partial<DentalVisit>) => void }
export const selectClass = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"

export function ConsultationPanel({ visit, readOnly, update }: Props) {
  const fields = [
    ["reason", "Motivo de consulta"], ["diagnosis", "Diagnóstico"],
    ["procedures", "Procedimientos realizados"], ["evolution", "Evolución por visita"], ["notes", "Notas profesionales"],
  ] as const
  return <Card><CardHeader><CardTitle>Evolución y diagnóstico</CardTitle></CardHeader><CardContent className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2"><Label htmlFor="visit-date">Fecha de consulta</Label><Input id="visit-date" type="date" value={visit.date} readOnly={readOnly} onChange={(e) => update({ date: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="visit-professional">Profesional responsable</Label><Input id="visit-professional" value={visit.professional} readOnly={readOnly} onChange={(e) => update({ professional: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="visit-next">Próximo control</Label><Input id="visit-next" type="date" min={visit.date} value={visit.nextVisit} readOnly={readOnly} onChange={(e) => update({ nextVisit: e.target.value })} /></div>
    </div>
    {fields.map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={`visit-${key}`}>{label}</Label><Textarea id={`visit-${key}`} rows={3} value={visit[key]} readOnly={readOnly} onChange={(e) => update({ [key]: e.target.value })} placeholder={`Registrar ${label.toLowerCase()}…`} /></div>)}
  </CardContent></Card>
}

export function TreatmentPanel({ visit, readOnly, update }: Props) {
  const [description, setDescription] = useState("")
  const [tooth, setTooth] = useState("")
  return <Card><CardHeader><CardTitle>Plan de tratamiento</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">Registra los procedimientos previstos y su avance. El odontograma conserva también su plan gráfico original.</p>
    {!readOnly && <form className="grid items-end gap-3 sm:grid-cols-[130px_1fr_auto]" onSubmit={(event) => {
      event.preventDefault()
      if (!description.trim()) return
      update({ plan: [...visit.plan, { id: crypto.randomUUID(), description: description.trim(), tooth: tooth.trim(), status: "pendiente" }] })
      setDescription(""); setTooth("")
    }}>
      <div className="space-y-2"><Label htmlFor="plan-tooth">Pieza / zona</Label><Input id="plan-tooth" value={tooth} onChange={(e) => setTooth(e.target.value)} placeholder="Ej. 16" maxLength={60} /></div>
      <div className="space-y-2"><Label htmlFor="plan-description">Procedimiento previsto</Label><Input id="plan-description" value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={500} /></div>
      <Button type="submit"><Plus />Añadir al plan</Button>
    </form>}
    {visit.plan.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Sin procedimientos en el plan.</p>}
    {visit.plan.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.description}</p><p className="text-xs text-muted-foreground">Pieza / zona: {item.tooth || "General"}</p></div>
      <select className={`${selectClass} sm:w-40`} aria-label={`Estado de ${item.description}`} value={item.status} disabled={readOnly} onChange={(e) => update({ plan: visit.plan.map((row) => row.id === item.id ? { ...row, status: e.target.value as TreatmentStage } : row) })}>
        {Object.entries(treatmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {!readOnly && <Button variant="ghost" size="icon" aria-label={`Quitar ${item.description}`} onClick={() => update({ plan: visit.plan.filter((row) => row.id !== item.id) })}><Trash2 /></Button>}
    </div>)}
  </CardContent></Card>
}

export function ConsentPanel({ visit, readOnly, update }: Props) {
  return <Card><CardHeader><CardTitle>Consentimientos informados</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">Registra la información entregada y el estado del consentimiento. Adjunta el documento firmado en «Fotos y documentos».</p>
    {!readOnly && <Button variant="outline" onClick={() => update({ consents: [...visit.consents, { id: crypto.randomUUID(), procedure: "", information: "", status: "pendiente", signer: "", date: "" }] })}><Plus />Añadir consentimiento</Button>}
    {!visit.consents.length && <p className="p-6 text-center text-sm text-muted-foreground">Sin consentimientos registrados en esta visita.</p>}
    {visit.consents.map((item, index) => {
      const patch = (value: Partial<typeof item>) => update({ consents: visit.consents.map((row) => row.id === item.id ? { ...row, ...value } : row) })
      return <section key={item.id} className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between"><h3 className="text-sm font-medium">Consentimiento {index + 1}</h3>{!readOnly && <Button variant="ghost" size="icon" aria-label={`Quitar consentimiento ${index + 1}`} onClick={() => update({ consents: visit.consents.filter((row) => row.id !== item.id) })}><Trash2 /></Button>}</div>
        <div className="space-y-2"><Label htmlFor={`procedure-${item.id}`}>Procedimiento autorizado</Label><Input id={`procedure-${item.id}`} value={item.procedure} readOnly={readOnly} onChange={(e) => patch({ procedure: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor={`information-${item.id}`}>Información, riesgos y alternativas explicados</Label><Textarea id={`information-${item.id}`} value={item.information} readOnly={readOnly} onChange={(e) => patch({ information: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2"><Label htmlFor={`status-${item.id}`}>Estado del consentimiento</Label><select id={`status-${item.id}`} className={selectClass} value={item.status} disabled={readOnly} onChange={(e) => patch({ status: e.target.value as typeof item.status })}><option value="pendiente">Pendiente</option><option value="firmado">Firmado en documento</option><option value="rechazado">Rechazado</option></select></div>
          <div className="space-y-2"><Label htmlFor={`signer-${item.id}`}>Nombre del firmante</Label><Input id={`signer-${item.id}`} value={item.signer} readOnly={readOnly} onChange={(e) => patch({ signer: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor={`signed-${item.id}`}>Fecha de firma / decisión</Label><Input id={`signed-${item.id}`} type="date" value={item.date} readOnly={readOnly} onChange={(e) => patch({ date: e.target.value })} /></div>
        </div>
      </section>
    })}
  </CardContent></Card>
}
