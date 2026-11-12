import { useEffect, useId, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "react-router-dom"
import { Activity, AlertCircle, CalendarClock, ClipboardList, Info, Stethoscope } from "lucide-react"
import { FormProvider, useForm, useWatch, type FieldErrors, type Path } from "react-hook-form"
import { toast } from "sonner"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { formatDateOnly } from "@/shared/lib/date"
import { env } from "@/shared/lib/env"
import { getErrorMessage } from "@/shared/lib/error-message"
import { ApiError } from "@/shared/types/common"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { useUpdatePatient } from "@/modules/patients/api/patients.queries"
import { useTreatmentsList } from "@/modules/treatments/api/treatments.queries"
import { KpiCard } from "@/modules/reports/components/kpi-card"
import type { Patient } from "@/modules/patients/types/patient.types"

import { useSaveRecord } from "../api/clinical-history.queries"
import type { RecordDocumentContext } from "../lib/dental-export"
import { computeChartIndicators } from "../lib/chart-indicators"
import { mergePatientData, patientDataSchema, pickPatientData, type PatientDataValues } from "../lib/patient-data"
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
import { registerEncounterPath } from "../lib/routes"
import { additionalRecordSections, recordSections, type RecordTab } from "../lib/record-sections"
import { useNavigationPlacement, useSectionNavigation } from "../hooks/use-section-navigation"
import {
  recordFormSchema,
  type ChartSnapshot,
  type PatientClinicalHistory,
  type RecordFormValues,
} from "../types/clinical-history.types"
import { AttachmentsTab } from "./attachments-tab"
import { BackgroundTab } from "./background-tab"
import { ClinicalNavigation, ClinicalNavigationFooter } from "./clinical-navigation"
import navigationStyles from "./clinical-navigation.module.css"
import { DataConsentTab } from "./data-consent-tab"
import { EncountersTab } from "./encounters-tab"
import { ExportCard } from "./export-card"
import { OdontogramFrame, type ChartHandle } from "./odontogram-frame"
import { PatientAppointmentsTab } from "./patient-appointments-tab"
import { PatientDataTab } from "./patient-data-tab"
import { PerformedTreatmentsTab } from "./performed-treatments-tab"
import { PeriodontalEvolutionTab } from "./periodontal-evolution-tab"
import { RecordHeader } from "./record-header"
import { TreatmentPlanTab } from "./treatment-plan-tab"
import { TruthDeclarationCard } from "./truth-declaration-card"

export type { RecordTab } from "../lib/record-sections"

/** Lo que se edita en la historia: sus secciones más los datos del paciente (mismo registro que Pacientes). */
const workspaceSchema = recordFormSchema.extend({ patient: patientDataSchema })
type WorkspaceValues = RecordFormValues & { patient: PatientDataValues }
type WorkspaceSection = keyof WorkspaceValues

const sectionLabels: Record<WorkspaceSection, string> = { patient: "Datos del paciente", ...recordSectionLabels }
const sections = Object.keys(sectionLabels) as WorkspaceSection[]

/** Pestaña donde vive cada sección editable, para saltar a ella cuando tiene errores. */
const tabBySection: Record<WorkspaceSection, RecordTab> = {
  patient: "datos",
  chart: "odontograma",
  medicalBackground: "antecedentes",
  allergiesAndMedication: "antecedentes",
  habits: "antecedentes",
  dentalBackground: "antecedentes",
  periodontalBackground: "antecedentes",
  plan: "plan",
  dataConsent: "consentimiento",
  truthDeclaration: "consentimiento",
  attachments: "archivos",
  examRequests: "archivos",
}

function tabForField(field: string): RecordTab | undefined {
  return tabBySection[field.split(".")[0] as WorkspaceSection]
}

function recordValuesOf({ patient: _patient, ...values }: WorkspaceValues): RecordFormValues {
  return values
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
  /** Lleva a una atención (`?atencion=`): desde la pestaña Tratamientos, Citas o un examen solicitado. */
  onShowEncounter: (encounterId: string) => void
}

/**
 * Historia clínica editable. Los cambios quedan en pantalla hasta que se confirman con «Guardar
 * cambios»; no hay autoguardado. «Registrar atención» abre su propia página.
 */
export function RecordWorkspace({
  patient,
  history,
  initialTab,
  highlightedEncounterId,
  onReset,
  onReload,
  onShowEncounter,
}: RecordWorkspaceProps) {
  const navigate = useNavigate()
  const { record, encounters } = history
  const patientName = `${patient.firstName} ${patient.lastName}`
  const { data: professionals } = useProfessionals()
  // Catálogo completo (incluye inactivos) para nombrar los tratamientos en los documentos.
  const { data: catalog } = useTreatmentsList({ page: 1, pageSize: 100 })
  const initialValues = (): WorkspaceValues => ({ ...pickRecordValues(record), patient: pickPatientData(patient) })
  const form = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: initialValues(),
  })
  const saveRecord = useSaveRecord()
  const updatePatient = useUpdatePatient(patient.id)
  const saving = saveRecord.isPending || updatePatient.isPending
  const chartHandle = useRef<ChartHandle | null>(null)
  const chartReadyRef = useRef(false)
  const [chartReady, setChartReady] = useState(false)
  // Último estado guardado: contra él se detecta qué secciones cambiaron.
  const [saved, setSaved] = useState(initialValues)
  const [tab, setTab] = useState<RecordTab>(initialTab)
  const sectionHeadingId = useId()
  const navigationContainer = useRef<HTMLDivElement>(null)
  const navigation = useSectionNavigation(recordSections, tab, setTab, additionalRecordSections)
  const controlsInHeader = useNavigationPlacement(navigationContainer)
  const [confirmSave, setConfirmSave] = useState(false)
  // Secciones mostradas al pedir confirmación: el texto no cambia mientras el diálogo se cierra.
  const [saveSummary, setSaveSummary] = useState("")
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  // «Registrar atención» con cambios sin guardar: cita con la que se iba a abrir (o `null` sin cita).
  const [pendingRegister, setPendingRegister] = useState<{ appointmentId: string | null } | null>(null)
  const [conflict, setConflict] = useState(false)

  const values = useWatch({ control: form.control }) as WorkspaceValues
  const changed = changedSections(saved, values, sections)
  const hasChanges = changed.length > 0
  const changedLabels = listFormat.format(changed.map((section) => sectionLabels[section]))

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

  /** Secciones de la historia tal como están en pantalla, con el odontograma más reciente. */
  function currentRecordValues(): RecordFormValues {
    const formValues = recordValuesOf(form.getValues())
    const latestChart = chartHandle.current?.snapshot() ?? formValues.chart
    return {
      ...formValues,
      chart: withCaseData(latestChart, { patientName, birthDate: patient.birthDate, date: today() }),
    }
  }

  function onInvalid(errors: FieldErrors<WorkspaceValues>) {
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

  function showFieldErrors(errors: { field: string; message: string }[], prefix = "") {
    errors.forEach(({ field, message }) =>
      form.setError(`${prefix}${field}` as Path<WorkspaceValues>, { type: "server", message })
    )
    const target = tabForField(`${prefix}${errors[0].field}`)
    if (target) setTab(target)
  }

  /**
   * Guarda primero el paciente (si cambió) y luego la historia. Si el paciente falla, no se guarda
   * nada. Devuelve `true` si todo quedó guardado.
   */
  async function performSave() {
    const current = form.getValues()
    const pending = changedSections(saved, current, sections)
    let next: WorkspaceValues = { ...saved }
    try {
      if (pending.includes("patient")) {
        try {
          const updated = await updatePatient.mutateAsync(mergePatientData(patient, current.patient))
          next = { ...next, patient: pickPatientData(updated) }
        } catch (error) {
          if (error instanceof ApiError && error.fieldErrors?.length) showFieldErrors(error.fieldErrors, "patient.")
          throw error
        }
      }
      if (pending.some((section) => section !== "patient")) {
        const result = await saveRecord.mutateAsync({ ...record, ...currentRecordValues() })
        next = { ...pickRecordValues(result), patient: next.patient }
      }
      form.reset(next)
      setSaved(next)
      setConfirmSave(false)
      toast.success("Cambios guardados en la historia clínica")
      return true
    } catch (error) {
      setConfirmSave(false)
      // Si el paciente ya se guardó, deja de figurar como cambio pendiente.
      if (next.patient !== saved.patient) {
        setSaved((value) => ({ ...value, patient: next.patient }))
      }
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true)
        return false
      }
      if (error instanceof ApiError && error.fieldErrors?.length && !pending.includes("patient")) {
        showFieldErrors(error.fieldErrors)
      }
      toast.error(getErrorMessage(error))
      return false
    }
  }

  function goBack() {
    if (hasChanges) setConfirmLeave(true)
    else navigate(`/pacientes/${patient.id}`)
  }

  /**
   * La atención se registra en su propia página y copia el odontograma **guardado**: con cambios
   * pendientes, antes hay que guardarlos o descartarlos.
   */
  function openRegister(appointmentId: string | null) {
    if (hasChanges) setPendingRegister({ appointmentId })
    else navigate(registerEncounterPath(patient.id, appointmentId))
  }

  function saveAndRegister() {
    const target = pendingRegister
    if (!target) return
    void form.handleSubmit(
      async () => {
        if (await performSave()) {
          setPendingRegister(null)
          navigate(registerEncounterPath(patient.id, target.appointmentId))
        }
      },
      (errors) => {
        setPendingRegister(null)
        onInvalid(errors)
      }
    )()
  }

  function showEncounter(encounterId: string) {
    setTab("atenciones")
    onShowEncounter(encounterId)
  }

  const documentContext: RecordDocumentContext = {
    patient,
    patientName,
    documentId: patient.documentId,
    professionals: professionals ?? [],
    professionalName: (encounter) => resolveProfessionalName(encounter, professionals),
    treatmentName: (treatmentId, fallback) => (treatmentId && treatmentById.get(treatmentId)?.name) || fallback,
  }

  return (
    <FormProvider {...form}>
      <div ref={navigationContainer} className={`${navigationStyles.scope} min-w-0 space-y-5`}>
        <RecordHeader patient={patient} record={record} onBack={goBack} onRegisterEncounter={() => openRegister(null)} />

        {/* MOCK-ONLY */}
        {env.useMockApi && (
          <p role="note" className="clinic-demo-notice">
            <Info aria-hidden="true" className="size-4 shrink-0" />
            <span>
            Modo demostración: la historia clínica se guarda en este navegador y no se sincroniza con un servidor. Los
            datos del paciente se guardan en memoria y vuelven a los de ejemplo al recargar la página.
            </span>
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

        <ClinicalNavigation navigation={navigation} controlsInHeader={controlsInHeader} headingId={sectionHeadingId} errorSections={errorTabs} />

        <Tabs value={tab} onValueChange={(value) => setTab(value as RecordTab)} className="relative">
          <TabsContent value="datos" role="region" aria-labelledby={sectionHeadingId}>
            <PatientDataTab patient={patient} record={record} />
          </TabsContent>
          <TabsContent value="antecedentes" role="region" aria-labelledby={sectionHeadingId}>
            <BackgroundTab />
          </TabsContent>
          <TabsContent value="odontograma" role="region" aria-labelledby={sectionHeadingId}>
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
          <TabsContent value="plan" role="region" aria-labelledby={sectionHeadingId}>
            <TreatmentPlanTab />
          </TabsContent>
          <TabsContent value="consentimiento" role="region" aria-labelledby={sectionHeadingId} className="space-y-4">
            <DataConsentTab patientId={patient.id} />
            <TruthDeclarationCard />
          </TabsContent>
          <TabsContent value="archivos" role="region" aria-labelledby={sectionHeadingId}>
            <AttachmentsTab patientId={patient.id} onOpenEncounter={showEncounter} />
          </TabsContent>
          <TabsContent value="atenciones" role="region" aria-labelledby={sectionHeadingId}>
            <EncountersTab
              patientId={patient.id}
              patientName={patientName}
              birthDate={patient.birthDate}
              encounters={encounters}
              highlightedId={highlightedEncounterId}
              documentContext={documentContext}
            />
          </TabsContent>
          <TabsContent value="tratamientos" role="region" aria-labelledby={sectionHeadingId}>
            <PerformedTreatmentsTab
              patientId={patient.id}
              encounters={encounters}
              professionalName={documentContext.professionalName}
              onOpenEncounter={showEncounter}
            />
          </TabsContent>
          <TabsContent value="citas" role="region" aria-labelledby={sectionHeadingId}>
            <PatientAppointmentsTab
              patientId={patient.id}
              encounters={encounters}
              treatmentName={(treatmentId) => treatmentById.get(treatmentId)?.name}
              onRegisterEncounter={openRegister}
              onOpenEncounter={showEncounter}
            />
          </TabsContent>
          <TabsContent value="evolucion" role="region" aria-labelledby={sectionHeadingId}>
            <PeriodontalEvolutionTab encounters={encounters} />
          </TabsContent>
        </Tabs>

        <ExportCard
          context={documentContext}
          getCurrentHistory={() => ({ encounters, record: { ...record, ...currentRecordValues() } })}
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
              <Button variant="outline" disabled={saving} onClick={() => setConfirmDiscard(true)}>
                Descartar cambios
              </Button>
              <Button disabled={saving || !chartReady} onClick={requestSave}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        )}

        <ClinicalNavigationFooter navigation={navigation} controlsInHeader={controlsInHeader} />
      </div>

      <ConfirmDialog
        open={confirmSave}
        onOpenChange={(open) => !saving && setConfirmSave(open)}
        title="Guardar cambios"
        description={`Se guardarán los cambios en ${saveSummary}.`}
        confirmLabel="Guardar cambios"
        isLoading={saving}
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

      <AlertDialog open={Boolean(pendingRegister)} onOpenChange={(open) => !open && !saving && setPendingRegister(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>La historia tiene cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Hay cambios en {changedLabels}. La atención copia el odontograma guardado, así que antes de registrarla
              guarda o descarta esos cambios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Volver</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                const target = pendingRegister
                setPendingRegister(null)
                navigate(registerEncounterPath(patient.id, target?.appointmentId))
              }}
            >
              Descartar y continuar
            </Button>
            <Button disabled={saving || !chartReady} onClick={saveAndRegister}>
              {saving ? "Guardando..." : "Guardar cambios y continuar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormProvider>
  )
}
