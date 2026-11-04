import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "react-router-dom"
import { Activity, AlertCircle, CalendarClock, ClipboardList, Stethoscope } from "lucide-react"
import { FormProvider, useForm, useWatch, type FieldErrors, type Path } from "react-hook-form"
import { toast } from "sonner"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { formatDateOnly } from "@/shared/lib/date"
import { env } from "@/shared/lib/env"
import { getErrorMessage } from "@/shared/lib/error-message"
import { createId } from "@/shared/lib/id"
import { ApiError } from "@/shared/types/common"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { useTreatmentsList } from "@/modules/treatments/api/treatments.queries"
import { KpiCard } from "@/modules/reports/components/kpi-card"
import type { Patient } from "@/modules/patients/types/patient.types"

import { useRegisterEncounter, useSaveRecord } from "../api/clinical-history.queries"
import type { RecordDocumentContext } from "../lib/dental-export"
import { computeChartIndicators } from "../lib/chart-indicators"
import {
  changedSections,
  countPerformedTreatments,
  latestEncounter,
  pickRecordValues,
  recordSectionLabels,
  resolveProfessionalName,
  today,
  withCaseData,
} from "../lib/record"
import {
  recordFormSchema,
  type ChartSnapshot,
  type EncounterFormValues,
  type PatientClinicalHistory,
  type RecordFormValues,
} from "../types/clinical-history.types"
import { AttachmentsTab } from "./attachments-tab"
import { DataConsentTab } from "./data-consent-tab"
import { EncountersTab } from "./encounters-tab"
import { ExportCard } from "./export-card"
import { OdontogramFrame, type ChartHandle } from "./odontogram-frame"
import { PatientAppointmentsTab } from "./patient-appointments-tab"
import { PerformedTreatmentsTab } from "./performed-treatments-tab"
import { PeriodontalEvolutionTab } from "./periodontal-evolution-tab"
import { RecordHeader } from "./record-header"
import { RegisterEncounterDialog } from "./register-encounter-dialog"
import { TreatmentPlanTab } from "./treatment-plan-tab"

export type RecordTab =
  | "odontograma"
  | "plan"
  | "consentimiento"
  | "archivos"
  | "atenciones"
  | "tratamientos"
  | "citas"
  | "evolucion"

/** Pestaña donde vive cada sección editable, para saltar a ella cuando tiene errores. */
const tabBySection: Record<keyof RecordFormValues, RecordTab> = {
  chart: "odontograma",
  plan: "plan",
  dataConsent: "consentimiento",
  attachments: "archivos",
}

function tabForField(field: string): RecordTab | undefined {
  return tabBySection[field.split(".")[0] as keyof RecordFormValues]
}

const listFormat = new Intl.ListFormat("es", { style: "long", type: "conjunction" })
const shortDate = (value: string) => formatDateOnly(value, { day: "2-digit", month: "short", year: "numeric" })

interface RecordWorkspaceProps {
  patient: Patient
  history: PatientClinicalHistory
  initialTab: RecordTab
  /** Atención abierta desde la URL (`?atencion=`). */
  highlightedEncounterId: string | null
  /** Vuelve a montar la historia desde la caché, en la misma pestaña: descarta lo que no se guardó. */
  onReset: (tab: RecordTab) => void
  /** Vuelve a pedir la historia al servidor (tras un conflicto) y la monta de nuevo. */
  onReload: (tab: RecordTab) => void
  /** Cita de `?cita=` sin atención: abre «Registrar atención» con esa cita preseleccionada. */
  pendingAppointmentId: string | null
  /** Se cerró «Registrar atención» (con o sin guardar): la cita de la URL ya se atendió. */
  onAppointmentHandled: () => void
  /** Lleva a una atención (`?atencion=`): tras registrarla o desde la pestaña Tratamientos. */
  onShowEncounter: (encounterId: string) => void
}

/**
 * Historia clínica editable. Los cambios quedan en pantalla hasta que se confirman con «Guardar
 * cambios»; no hay autoguardado.
 */
export function RecordWorkspace({
  patient,
  history,
  initialTab,
  highlightedEncounterId,
  onReset,
  onReload,
  pendingAppointmentId,
  onAppointmentHandled,
  onShowEncounter,
}: RecordWorkspaceProps) {
  const navigate = useNavigate()
  const { record, encounters } = history
  const patientName = `${patient.firstName} ${patient.lastName}`
  const { data: professionals } = useProfessionals()
  // Catálogo completo (incluye inactivos) para nombrar los tratamientos en los documentos.
  const { data: catalog } = useTreatmentsList({ page: 1, pageSize: 100 })
  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordFormSchema),
    defaultValues: pickRecordValues(record),
  })
  const saveRecord = useSaveRecord()
  const chartHandle = useRef<ChartHandle | null>(null)
  const chartReadyRef = useRef(false)
  const [chartReady, setChartReady] = useState(false)
  // Último estado guardado: contra él se detecta qué secciones cambiaron.
  const [saved, setSaved] = useState(() => pickRecordValues(record))
  const [tab, setTab] = useState<RecordTab>(initialTab)
  const [confirmSave, setConfirmSave] = useState(false)
  // Secciones mostradas al pedir confirmación: el texto no cambia mientras el diálogo se cierra.
  const [saveSummary, setSaveSummary] = useState("")
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [conflict, setConflict] = useState(false)
  const registerEncounter = useRegisterEncounter(patient.id)
  const [registerOpen, setRegisterOpen] = useState(Boolean(pendingAppointmentId))
  // Cita con la que se abre «Registrar atención»: la de la URL o la elegida en la pestaña Citas.
  const [registerAppointmentId, setRegisterAppointmentId] = useState(pendingAppointmentId)
  // Id de la próxima atención: se genera antes de guardar, así un reintento no la duplica.
  const encounterId = useRef(createId())
  // Tras registrar, la URL ya apunta a la atención nueva: cerrar el diálogo no debe limpiarla.
  const justRegistered = useRef(false)

  const values = useWatch({ control: form.control }) as RecordFormValues
  const changed = changedSections(saved, values)
  const hasChanges = changed.length > 0
  const changedLabels = listFormat.format(changed.map((section) => recordSectionLabels[section]))

  // Aviso del navegador al cerrar o recargar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!hasChanges) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [hasChanges])

  const indicators = computeChartIndicators(values.chart)
  const last = latestEncounter(encounters)
  const errorTabs = new Set(Object.keys(form.formState.errors).map(tabForField))
  const treatmentById = new Map((catalog?.items ?? []).map((treatment) => [treatment.id, treatment]))

  function handleChartReady(ready: boolean) {
    chartReadyRef.current = ready
    setChartReady(ready)
  }

  function handleChartChange(next: ChartSnapshot) {
    // El editor emite su estado apenas carga: ese primer estado es el punto de partida, no un cambio.
    if (!chartReadyRef.current) setSaved((current) => ({ ...current, chart: next }))
    form.setValue("chart", next, { shouldDirty: chartReadyRef.current })
  }

  function currentValues(): RecordFormValues {
    const formValues = form.getValues()
    const latestChart = chartHandle.current?.snapshot() ?? formValues.chart
    return {
      ...formValues,
      chart: withCaseData(latestChart, { patientName, birthDate: patient.birthDate, date: today() }),
    }
  }

  function onInvalid(errors: FieldErrors<RecordFormValues>) {
    const target = Object.keys(errors).map(tabForField).find(Boolean)
    if (target) setTab(target)
    toast.error("Revisa los campos marcados antes de guardar")
  }

  function requestSave() {
    void form.handleSubmit(() => {
      setSaveSummary(changedLabels)
      setConfirmSave(true)
    }, onInvalid)()
  }

  async function performSave() {
    try {
      const result = await saveRecord.mutateAsync({ ...record, ...currentValues() })
      const next = pickRecordValues(result)
      form.reset(next)
      setSaved(next)
      setConfirmSave(false)
      toast.success("Cambios guardados en la historia clínica")
    } catch (error) {
      setConfirmSave(false)
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true)
        return
      }
      if (error instanceof ApiError && error.fieldErrors?.length) {
        error.fieldErrors.forEach(({ field, message }) =>
          form.setError(field as Path<RecordFormValues>, { type: "server", message })
        )
        const target = tabForField(error.fieldErrors[0].field)
        if (target) setTab(target)
      }
      toast.error(getErrorMessage(error))
    }
  }

  function goBack() {
    if (hasChanges) setConfirmLeave(true)
    else navigate(`/pacientes/${patient.id}`)
  }

  function openRegister(appointmentId: string | null) {
    setRegisterAppointmentId(appointmentId)
    setRegisterOpen(true)
  }

  function showEncounter(encounterId: string) {
    setTab("atenciones")
    onShowEncounter(encounterId)
  }

  function handleRegisterOpenChange(open: boolean) {
    setRegisterOpen(open)
    if (!open && pendingAppointmentId && !justRegistered.current) onAppointmentHandled()
    justRegistered.current = false
  }

  /** Los cambios pendientes de la historia se guardan con la atención: antes deben ser válidos. */
  async function validateRecordForEncounter() {
    if (!hasChanges || (await form.trigger())) return true
    setRegisterOpen(false)
    onInvalid(form.formState.errors)
    toast.info("Corrige la historia y vuelve a «Registrar atención»: lo escrito en la atención se conserva.")
    return false
  }

  async function performRegister(values: EncounterFormValues) {
    const current = currentValues()
    const chartSnapshot = withCaseData(current.chart, { patientName, birthDate: patient.birthDate, date: values.date })
    try {
      const result = await registerEncounter.mutateAsync({
        record: hasChanges ? { ...record, ...current } : record,
        hasPendingChanges: hasChanges,
        encounter: { ...values, id: encounterId.current, chartSnapshot },
      })
      if (result.record) {
        const next = pickRecordValues(result.record)
        form.reset(next)
        setSaved(next)
      }
      encounterId.current = createId()
      toast.success("Atención registrada")
      if (result.appointmentCompleted) toast.success("La cita vinculada quedó como completada")
      result.warnings.forEach((warning) => toast.warning(warning))
      setTab("atenciones")
      justRegistered.current = true
      onShowEncounter(result.encounter.id)
    } catch (error) {
      // Un 409 sin campos es de la historia (revisión); con campos, es de la atención (cita ya usada).
      if (error instanceof ApiError && error.status === 409 && !error.fieldErrors?.length) setConflict(true)
      throw error
    }
  }

  const documentContext: RecordDocumentContext = {
    patientName,
    documentId: patient.documentId,
    professionalName: (encounter) => resolveProfessionalName(encounter, professionals),
    treatmentName: (treatmentId, fallback) => (treatmentId && treatmentById.get(treatmentId)?.name) || fallback,
  }

  const tabs: { value: RecordTab; label: string }[] = [
    { value: "odontograma", label: "Odontograma y periodontograma" },
    { value: "plan", label: "Plan de tratamiento" },
    { value: "consentimiento", label: "Consentimiento de datos" },
    { value: "archivos", label: "Fotos y documentos" },
    { value: "atenciones", label: "Atenciones" },
    { value: "tratamientos", label: "Tratamientos" },
    { value: "citas", label: "Citas" },
    { value: "evolucion", label: "Evolución periodontal" },
  ]

  return (
    <FormProvider {...form}>
      <div className="min-w-0 space-y-5">
        <RecordHeader
          patient={patient}
          consentPending={record.dataConsent.status === "pendiente"}
          canRegister={chartReady}
          onBack={goBack}
          onRegisterEncounter={() => openRegister(null)}
        />

        {/* MOCK-ONLY */}
        {env.useMockApi && (
          <p className="text-xs text-muted-foreground">
            Modo demostración: la historia clínica se guarda en este navegador y no se sincroniza con un servidor.
          </p>
        )}

        {conflict && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>La historia cambió en otra pestaña</AlertTitle>
            <AlertDescription>
              Otra pestaña o usuario guardó cambios en esta historia. Recárgala para continuar; los cambios de esta
              pantalla que no se guardaron se perderán.
            </AlertDescription>
            <AlertAction>
              <Button size="sm" variant="outline" onClick={() => onReload(tab)}>
                Recargar historia
              </Button>
            </AlertAction>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Atenciones registradas" value={encounters.length} icon={ClipboardList} />
          <KpiCard label="Tratamientos realizados" value={countPerformedTreatments(encounters)} icon={Stethoscope} />
          <KpiCard
            label="Próximo control"
            value={last?.nextVisit ? shortDate(last.nextVisit) : "Por definir"}
            hint={last?.nextVisit ? `Según la atención del ${shortDate(last.date)}` : undefined}
            icon={CalendarClock}
          />
          <KpiCard
            label="Sangrado al sondaje"
            value={indicators?.bleedingPercent != null ? `${indicators.bleedingPercent}%` : "Sin registro"}
            hint={indicators ? `${indicators.sitesWithPocket} sitios con bolsa ≥ 4 mm` : undefined}
            icon={Activity}
          />
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as RecordTab)} className="relative">
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

          <TabsContent value="odontograma">
            <p className="text-sm text-muted-foreground">
              Selecciona una pieza para registrar hallazgos. Cambia a «Estado periodontal» dentro del editor para las
              mediciones por sitio.
            </p>
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
              source={{ chart: record.chart, date: today() }}
              patientName={patientName}
              birthDate={patient.birthDate}
              readOnly={false}
              handle={chartHandle}
              onReady={handleChartReady}
              onChange={handleChartChange}
            />
          </div>
          <TabsContent value="plan">
            <TreatmentPlanTab />
          </TabsContent>
          <TabsContent value="consentimiento">
            <DataConsentTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="archivos">
            <AttachmentsTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="atenciones">
            <EncountersTab
              patientId={patient.id}
              patientName={patientName}
              birthDate={patient.birthDate}
              encounters={encounters}
              highlightedId={highlightedEncounterId}
              documentContext={documentContext}
            />
          </TabsContent>
          <TabsContent value="tratamientos">
            <PerformedTreatmentsTab
              patientId={patient.id}
              encounters={encounters}
              professionalName={documentContext.professionalName}
              onOpenEncounter={showEncounter}
            />
          </TabsContent>
          <TabsContent value="citas">
            <PatientAppointmentsTab
              patientId={patient.id}
              encounters={encounters}
              treatmentName={(treatmentId) => treatmentById.get(treatmentId)?.name}
              canRegister={chartReady}
              onRegisterEncounter={openRegister}
              onOpenEncounter={showEncounter}
            />
          </TabsContent>
          <TabsContent value="evolucion">
            <PeriodontalEvolutionTab encounters={encounters} />
          </TabsContent>
        </Tabs>

        <ExportCard
          context={documentContext}
          getCurrentHistory={() => ({ encounters, record: { ...record, ...currentValues() } })}
          captureOdontogramImage={async () => (await chartHandle.current?.captureImage()) ?? null}
          disabled={!chartReady}
        />

        {hasChanges && (
          <div
            role="region"
            aria-label="Cambios sin guardar"
            className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-lg"
          >
            <p className="text-sm">
              <span className="font-medium">Tienes cambios sin guardar</span>
              <span className="text-muted-foreground"> en {changedLabels}.</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={saveRecord.isPending} onClick={() => setConfirmDiscard(true)}>
                Descartar cambios
              </Button>
              <Button disabled={saveRecord.isPending || !chartReady} onClick={requestSave}>
                {saveRecord.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmSave}
        onOpenChange={(open) => !saveRecord.isPending && setConfirmSave(open)}
        title="Guardar cambios"
        description={`Se guardarán los cambios en ${saveSummary}.`}
        confirmLabel="Guardar cambios"
        isLoading={saveRecord.isPending}
        onConfirm={() => void performSave()}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Descartar cambios"
        description={`Se perderán los cambios en ${changedLabels} y la historia volverá al último estado guardado.`}
        confirmLabel="Descartar"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false)
          onReset(tab)
        }}
      />
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Salir sin guardar"
        description={`Tienes cambios sin guardar en ${changedLabels}. Si sales ahora, se perderán.`}
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => navigate(`/pacientes/${patient.id}`)}
      />
      {/* Tiene su propio formulario (y su propio FormProvider): no comparte valores con la historia. */}
      <RegisterEncounterDialog
        open={registerOpen}
        onOpenChange={handleRegisterOpenChange}
        patientId={patient.id}
        encounters={encounters}
        appointmentId={registerAppointmentId}
        proposed={values.plan}
        pendingChanges={hasChanges ? changedLabels : ""}
        validateRecord={validateRecordForEncounter}
        onRegister={performRegister}
      />
    </FormProvider>
  )
}
