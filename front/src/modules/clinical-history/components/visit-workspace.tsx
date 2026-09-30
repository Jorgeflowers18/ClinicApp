import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Activity, AlertCircle, CalendarClock, ClipboardList, Lock, Stethoscope } from "lucide-react"
import { FormProvider, useForm, useWatch, type FieldErrors, type Path } from "react-hook-form"
import { toast } from "sonner"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { formatDateOnly, formatDateTime } from "@/shared/lib/date"
import { env } from "@/shared/lib/env"
import { getErrorMessage } from "@/shared/lib/error-message"
import { ApiError } from "@/shared/types/common"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { KpiCard } from "@/modules/reports/components/kpi-card"
import type { Patient } from "@/modules/patients/types/patient.types"

import { useCloseVisit, useDiscardDraft } from "../api/clinical-history.queries"
import { useVisitAutosave, type AutosaveStatus } from "../hooks/use-visit-autosave"
import { computeChartIndicators } from "../lib/chart-indicators"
import { closedVisits, pickFormValues, resolveProfessionalName, withCaseData } from "../lib/visit"
import {
  assignablePlanStatuses,
  visitFormSchema,
  type DentalRecord,
  type DentalVisit,
  type VisitFormValues,
} from "../types/clinical-history.types"
import { AttachmentsTab } from "./attachments-tab"
import { ConsentsTab } from "./consents-tab"
import { ConsultationTab } from "./consultation-tab"
import { ExportCard } from "./export-card"
import { FollowUpTab } from "./follow-up-tab"
import { OdontogramFrame, type ChartHandle } from "./odontogram-frame"
import { TreatmentPlanTab } from "./treatment-plan-tab"

type VisitTab = "odontograma" | "consulta" | "plan" | "consentimientos" | "archivos" | "seguimiento"

/** Pestaña donde vive cada campo del formulario, para saltar a ella cuando tiene errores. */
const tabByField: Record<keyof VisitFormValues, VisitTab> = {
  chart: "odontograma",
  date: "consulta",
  professionalId: "consulta",
  appointmentId: "consulta",
  reason: "consulta",
  diagnosis: "consulta",
  procedures: "consulta",
  evolution: "consulta",
  notes: "consulta",
  nextVisit: "consulta",
  plan: "plan",
  consents: "consentimientos",
  attachments: "archivos",
}

function tabForField(field: string): VisitTab | undefined {
  return tabByField[field.split(".")[0] as keyof VisitFormValues]
}

const autosaveLabels: Record<AutosaveStatus, string> = {
  idle: "Sin cambios pendientes",
  saving: "Guardando borrador...",
  saved: "Borrador guardado",
  error: "No se guardaron los últimos cambios",
}

interface VisitWorkspaceProps {
  patient: Patient
  record: DentalRecord
  visit: DentalVisit
  onOpenVisit: (visitId: string) => void
  onClosed: (visit: DentalVisit) => void
  onDiscarded: () => void
  onReload: () => void
}

export function VisitWorkspace({ patient, record, visit, onOpenVisit, onClosed, onDiscarded, onReload }: VisitWorkspaceProps) {
  const readOnly = visit.status === "cerrada"
  const patientName = `${patient.firstName} ${patient.lastName}`
  const { data: professionals } = useProfessionals()
  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: pickFormValues(visit),
  })
  const autosave = useVisitAutosave(visit, !readOnly)
  const closeVisit = useCloseVisit(patient.id)
  const discardDraft = useDiscardDraft(patient.id)
  const chartHandle = useRef<ChartHandle | null>(null)
  const visitRef = useRef(visit)
  const locked = useRef(false)
  const [chartReady, setChartReady] = useState(false)
  const [tab, setTab] = useState<VisitTab>("odontograma")
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    visitRef.current = visit
  })

  // Autoguardado: cada cambio del formulario se envía completo; el hook agrupa y serializa los guardados.
  const { patch } = autosave
  useEffect(() => {
    if (readOnly) return
    const subscription = form.watch(() => {
      if (locked.current) return
      patch({ ...visitRef.current, ...form.getValues() })
    })
    return () => subscription.unsubscribe()
  }, [form, patch, readOnly])

  const [plan, nextVisit, chart, professionalId] = useWatch({
    control: form.control,
    name: ["plan", "nextVisit", "chart", "professionalId"],
  })
  const indicators = computeChartIndicators(chart)
  const errorTabs = new Set(Object.keys(form.formState.errors).map(tabForField))
  const professionalName = resolveProfessionalName({ ...visit, professionalId }, professionals)
  const toAssign = plan.filter((item) => assignablePlanStatuses.includes(item.status) && !item.assignmentId && item.treatmentId)

  function currentVisit(): DentalVisit {
    const values = form.getValues()
    const latestChart = chartHandle.current?.snapshot() ?? values.chart
    return {
      ...visitRef.current,
      ...values,
      chart: withCaseData(latestChart, { patientName, birthDate: patient.birthDate, date: values.date }),
    }
  }

  function onInvalid(errors: FieldErrors<VisitFormValues>) {
    const target = Object.keys(errors).map(tabForField).find(Boolean)
    if (target) setTab(target)
    toast.error("Revisa los campos marcados antes de cerrar la visita")
  }

  function requestClose() {
    const snapshot = chartHandle.current?.snapshot()
    if (snapshot) form.setValue("chart", snapshot, { shouldDirty: true })
    void form.handleSubmit(() => setConfirmClose(true), onInvalid)()
  }

  async function performClose() {
    locked.current = true
    try {
      const saved = await autosave.flush()
      const result = await closeVisit.mutateAsync({ ...saved, ...currentVisit(), revision: saved.revision })
      setConfirmClose(false)
      toast.success(
        result.createdAssignmentIds.length
          ? `Visita cerrada. Se asignaron ${result.createdAssignmentIds.length} tratamientos al paciente.`
          : "Visita cerrada"
      )
      if (result.appointmentCompleted) toast.success("La cita vinculada quedó como completada")
      result.warnings.forEach((warning) => toast.warning(warning))
      onClosed(result.visit)
    } catch (error) {
      locked.current = false
      setConfirmClose(false)
      if (error instanceof ApiError && error.fieldErrors?.length) {
        error.fieldErrors.forEach(({ field, message }) =>
          form.setError(field as Path<VisitFormValues>, { type: "server", message })
        )
        const target = tabForField(error.fieldErrors[0].field)
        if (target) setTab(target)
      }
      toast.error(getErrorMessage(error))
    }
  }

  async function performDiscard() {
    locked.current = true
    try {
      await autosave.flush().catch(() => undefined)
      await discardDraft.mutateAsync(visit.id)
      setConfirmDiscard(false)
      toast.success("Borrador descartado")
      onDiscarded()
    } catch (error) {
      locked.current = false
      toast.error(getErrorMessage(error))
    }
  }

  const busy = closeVisit.isPending || discardDraft.isPending
  const tabs: { value: VisitTab; label: string }[] = [
    { value: "odontograma", label: "Odontograma y periodontograma" },
    { value: "consulta", label: "Evolución y diagnóstico" },
    { value: "plan", label: "Plan de tratamiento" },
    { value: "consentimientos", label: "Consentimientos" },
    { value: "archivos", label: "Fotos y documentos" },
    { value: "seguimiento", label: "Seguimiento por visita" },
  ]

  return (
    <FormProvider {...form}>
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={readOnly ? "outline" : "secondary"}>
              {readOnly && <Lock />}
              {readOnly ? "Visita cerrada · solo lectura" : "Borrador en edición"}
            </Badge>
            <span>
              {formatDateOnly(visit.date, { day: "2-digit", month: "long", year: "numeric" })} · {professionalName}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span role="status" className="text-xs text-muted-foreground">
              {readOnly
                ? visit.closedAt
                  ? `Cerrada el ${formatDateTime(visit.closedAt, { day: "2-digit", month: "short", year: "numeric" })}`
                  : "Visita cerrada"
                : autosaveLabels[autosave.status]}
            </span>
            {!readOnly && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => setConfirmDiscard(true)}>
                  Descartar borrador
                </Button>
                <Button disabled={busy || !chartReady} onClick={requestClose}>
                  {closeVisit.isPending ? "Cerrando..." : "Cerrar visita"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* MOCK-ONLY */}
        {env.useMockApi && !readOnly && (
          <p className="text-xs text-muted-foreground">
            Modo demostración: la historia clínica se guarda en este navegador y no se sincroniza con un servidor.
          </p>
        )}

        {autosave.status === "error" && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>{autosave.isConflict ? "La visita cambió en otra pestaña" : "No se pudo guardar el borrador"}</AlertTitle>
            <AlertDescription>
              {autosave.isConflict
                ? "Otra pestaña o usuario modificó esta visita. Recarga la historia para continuar; los cambios de esta pantalla que no se guardaron se perderán."
                : `${getErrorMessage(autosave.error)} Los cambios siguen en pantalla.`}
            </AlertDescription>
            <AlertAction>
              {autosave.isConflict ? (
                <Button size="sm" variant="outline" onClick={onReload}>
                  Recargar historia
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void autosave.flush().catch(() => undefined)}>
                  Reintentar
                </Button>
              )}
            </AlertAction>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Visitas cerradas" value={closedVisits(record).length} icon={ClipboardList} />
          <KpiCard
            label="Plan de esta visita"
            value={`${plan.filter((item) => item.status === "realizado").length} / ${plan.length}`}
            hint="Realizados / total"
            icon={Stethoscope}
          />
          <KpiCard
            label="Próximo control"
            value={nextVisit ? formatDateOnly(nextVisit, { day: "2-digit", month: "short", year: "numeric" }) : "Por definir"}
            icon={CalendarClock}
          />
          <KpiCard
            label="Sangrado al sondaje"
            value={indicators?.bleedingPercent != null ? `${indicators.bleedingPercent}%` : "Sin registro"}
            hint={indicators ? `${indicators.sitesWithPocket} sitios con bolsa ≥ 4 mm` : undefined}
            icon={Activity}
          />
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as VisitTab)} className="relative">
          <div className="overflow-x-auto pb-2">
            <TabsList variant="line" className="gap-3">
              {tabs.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                  {errorTabs.has(item.value) && (
                    <span className="size-1.5 rounded-full bg-destructive" aria-label="Con errores" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="odontograma" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecciona una pieza para registrar hallazgos. Cambia a «Estado periodontal» dentro del editor para las
              mediciones por sitio.
            </p>
            <FieldError errors={form.formState.errors.chart ? [form.formState.errors.chart] : undefined} />
          </TabsContent>
          {/*
            El editor queda fuera del TabsContent: en otras pestañas se oculta con `invisible` y sin ocupar
            espacio, pero conserva su tamaño. Con `display: none` la librería mide todo en cero y la imagen
            del odontograma para el PDF sale en blanco.
          */}
          <div
            aria-hidden={tab !== "odontograma"}
            inert={tab !== "odontograma"}
            className={tab === "odontograma" ? "mt-3" : "pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"}
          >
            <OdontogramFrame
              visit={visit}
              patientName={patientName}
              birthDate={patient.birthDate}
              readOnly={readOnly}
              handle={chartHandle}
              onReady={setChartReady}
              onChange={(next) => {
                if (!readOnly) form.setValue("chart", next, { shouldDirty: true })
              }}
            />
          </div>
          <TabsContent value="consulta">
            <ConsultationTab visit={visit} record={record} readOnly={readOnly} />
          </TabsContent>
          <TabsContent value="plan">
            <TreatmentPlanTab patientId={patient.id} record={record} readOnly={readOnly} />
          </TabsContent>
          <TabsContent value="consentimientos">
            <ConsentsTab readOnly={readOnly} />
          </TabsContent>
          <TabsContent value="archivos">
            <AttachmentsTab patientId={patient.id} readOnly={readOnly} />
          </TabsContent>
          <TabsContent value="seguimiento">
            <FollowUpTab record={record} visit={visit} onOpenVisit={onOpenVisit} />
          </TabsContent>
        </Tabs>

        <ExportCard
          record={record}
          context={{ patientName, documentId: patient.documentId, professionalName }}
          getCurrentVisit={currentVisit}
          captureOdontogramImage={async () => (await chartHandle.current?.captureImage()) ?? null}
          disabled={!chartReady}
        />
      </div>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={(open) => !closeVisit.isPending && setConfirmClose(open)}
        title="Cerrar visita"
        description={
          <>
            La visita quedará en solo lectura.
            {toAssign.length > 0 && ` Se asignarán ${toAssign.length} tratamientos al paciente.`}
            {form.getValues("appointmentId") && " La cita vinculada pasará a «Completada»."}
          </>
        }
        confirmLabel="Cerrar visita"
        isLoading={closeVisit.isPending}
        onConfirm={() => void performClose()}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={(open) => !discardDraft.isPending && setConfirmDiscard(open)}
        title="Descartar borrador"
        description="Se eliminará el borrador de esta visita con su odontograma, plan, consentimientos y archivos. Esta acción no se puede deshacer."
        confirmLabel="Descartar"
        destructive
        isLoading={discardDraft.isPending}
        onConfirm={() => void performDiscard()}
      />
    </FormProvider>
  )
}
