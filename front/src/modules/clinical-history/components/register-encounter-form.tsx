import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { FormProvider, useForm, useWatch, type FieldPath, type Path } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { calculateAge } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { createId } from "@/shared/lib/id"
import { formatCurrency } from "@/shared/lib/number"
import { ApiError } from "@/shared/types/common"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import type { Patient } from "@/modules/patients/types/patient.types"

import { useRegisterEncounter } from "../api/clinical-history.queries"
import { useDefaultProfessionalId } from "../hooks/use-default-professional"
import { usePatientAppointmentOptions } from "../hooks/use-patient-appointment-options"
import { clinicalSnapshotOf, emptyEncounterValues } from "../lib/encounter"
import { encounterSections, encounterSteps, type EncounterStepId } from "../lib/encounter-summary"
import { sumCosts, today, withCaseData } from "../lib/record"
import { clinicalHistoryPath, encounterPath } from "../lib/routes"
import { encounterFormSchema, type EncounterFormValues, type PatientClinicalHistory } from "../types/clinical-history.types"
import { ClinicalFormActions } from "./clinical-form-actions"
import { EncounterReview } from "./encounter-review"
import { EncounterRevealContext, type EncounterReveal } from "./encounter-reveal-context"
import { StepDiagnosis } from "./encounter-steps/step-diagnosis"
import { StepExam } from "./encounter-steps/step-exam"
import { StepReason } from "./encounter-steps/step-reason"
import { StepTreatments } from "./encounter-steps/step-treatments"
import { StepVitals } from "./encounter-steps/step-vitals"
import { MedicalAlerts } from "./medical-alerts"
import "./register-encounter.css"
import "./encounter-dialog.css"

type Field = FieldPath<EncounterFormValues>

/** Campos que valida «Siguiente» en cada paso. */
const stepFields: Record<EncounterStepId, Field[]> = {
  motivo: ["appointmentId", "date", "professionalId", "reason", "presentIllness"],
  // La interconsulta se marca aquí, pero es un examen solicitado.
  signos: ["vitals", "asa", "riskAssessment", "requestedExams"],
  examen: ["extraoralExam", "intraoralExam", "pain", "cariesRisk", "periodontalRisk"],
  diagnostico: ["diagnoses", "prognosis", "periodontalDiagnosis", "maintenanceInterval"],
  tratamientos: ["procedures", "performedTreatments", "materials", "requestedExams", "examFindings", "evolution", "notes", "nextVisit"],
  revision: [],
}

const stepOfField = (field: string) =>
  encounterSteps.findIndex(({ id }) => stepFields[id].some((name) => name === field.split(".")[0]))

interface RegisterEncounterFormProps {
  patient: Patient
  history: PatientClinicalHistory
  /** Cita de `?cita=`: se preselecciona si sigue disponible. */
  appointmentId: string | null
}

/**
 * «Registrar atención» por pasos. Se puede ir y volver entre pasos; «Siguiente» valida solo el paso
 * actual y «Guardar atención» valida todo y lleva al primer paso con errores. La atención copia el
 * odontograma y las alertas de la historia **guardada**, y no se modifica después de guardarse.
 */
export function RegisterEncounterForm({ patient, history, appointmentId }: RegisterEncounterFormProps) {
  const navigate = useNavigate()
  const { record, encounters } = history
  const patientName = `${patient.firstName} ${patient.lastName}`
  const age = calculateAge(patient.birthDate)
  const form = useForm<EncounterFormValues>({
    resolver: zodResolver(encounterFormSchema),
    defaultValues: emptyEncounterValues(),
    shouldUnregister: false,
  })
  const { getValues, setValue } = form
  const { options } = usePatientAppointmentOptions(patient.id, encounters)
  // Una atención no puede tener fecha futura: solo se ofrecen las citas de hoy o anteriores.
  const appointmentOptions = useMemo(() => options.filter((option) => option.date <= today()), [options])
  const defaultProfessionalId = useDefaultProfessionalId()
  const { data: professionals } = useProfessionals()
  const registerEncounter = useRegisterEncounter(patient.id)
  const [step, setStep] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  // Id de la atención: se genera antes de guardar, así un reintento no la duplica.
  const encounterId = useRef(createId())
  // La cita se preselecciona una sola vez: si el usuario la quita, no vuelve.
  const appliedAppointment = useRef(false)
  const saving = registerEncounter.isPending
  const current = encounterSteps[step]
  const isDirty = form.formState.isDirty
  const heading = useRef<HTMLHeadingElement>(null)
  const modalHeading = useRef<HTMLHeadingElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const [dialogOpen, setDialogOpen] = useState(true)
  const finishingExit = useRef(false)
  const [reveal, setReveal] = useState<EncounterReveal | null>(null)
  const draft = useWatch({ control: form.control }) as EncounterFormValues
  // Read the existing schema only: display progress without triggering errors or changing validation.
  const validation = encounterFormSchema.safeParse(draft)
  const issues = validation.success ? [] : validation.error.issues
  const invalidSteps = new Set(issues.map((issue) => stepOfField(String(issue.path[0]))))
  const errorSteps = new Set(Object.keys(form.formState.errors).map(stepOfField))
  const filledSteps = new Set(encounterSections(draft).map((section) => section.step))

  // Las citas y los profesionales llegan de forma asíncrona: se completan solo si el usuario no eligió nada.
  useEffect(() => {
    const preselected = appointmentOptions.find((option) => option.appointment.id === appointmentId)
    if (preselected && !appliedAppointment.current) {
      appliedAppointment.current = true
      setValue("appointmentId", preselected.appointment.id)
      setValue("professionalId", preselected.appointment.professionalId)
      setValue("date", preselected.date)
      return
    }
    if (!getValues("professionalId") && defaultProfessionalId) setValue("professionalId", defaultProfessionalId)
  }, [appointmentOptions, appointmentId, defaultProfessionalId, getValues, setValue])

  // Aviso del navegador al cerrar o recargar con datos escritos.
  useEffect(() => {
    if (!isDirty || saving) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [isDirty, saving])

  function goToStep(index: number, field?: string) {
    setStep(index)
    setReveal(previous => field ? { step: encounterSteps[index].id, field, version: (previous?.version ?? 0) + 1 } : null)
    requestAnimationFrame(() => {
      scroll.current?.scrollTo({ top: 0, behavior: "instant" })
      heading.current?.focus({ preventScroll: true })
    })
  }

  async function next() {
    const valid = await form.trigger(stepFields[current.id])
    if (!valid) {
      const result = encounterFormSchema.safeParse(getValues())
      const issue = result.success ? undefined : result.error.issues.find(issue => stepFields[current.id].some(field => field === issue.path[0]))
      goToStep(step, issue?.path.join("."))
      toast.error("Revisa los campos marcados de este paso")
      return
    }
    goToStep(step + 1)
  }

  async function requestSave() {
    const valid = await form.trigger()
    if (!valid) {
      const first = Object.keys(form.formState.errors)
        .map(stepOfField)
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)[0]
      const result = encounterFormSchema.safeParse(getValues())
      const issue = result.success ? undefined : result.error.issues.find(issue => stepOfField(String(issue.path[0])) === first)
      if (first !== undefined) goToStep(first, issue?.path.join("."))
      toast.error("Revisa los campos marcados de la atención")
      return
    }
    setConfirming(true)
  }

  async function save() {
    const values = form.getValues()
    try {
      const result = await registerEncounter.mutateAsync({
        record,
        encounter: {
          ...values,
          id: encounterId.current,
          chartSnapshot: withCaseData(record.chart, { patientName, birthDate: patient.birthDate, date: values.date }),
          clinicalSnapshot: clinicalSnapshotOf(record),
        },
      })
      setConfirming(false)
      toast.success("Atención registrada")
      if (result.appointmentCompleted) toast.success("La cita vinculada quedó como completada")
      if (values.requestedExams.length) toast.info("Los exámenes solicitados quedaron pendientes en «Fotos y documentos»")
      result.warnings.forEach((warning) => toast.warning(warning))
      form.reset(values)
      navigate(encounterPath(patient.id, result.encounter.id), { replace: true })
    } catch (error) {
      setConfirming(false)
      if (error instanceof ApiError && error.fieldErrors?.length) {
        error.fieldErrors.forEach(({ field, message }) =>
          form.setError(field as Path<EncounterFormValues>, { type: "server", message })
        )
        const target = stepOfField(error.fieldErrors[0].field)
        if (target >= 0) goToStep(target, error.fieldErrors[0].field)
      }
      toast.error(getErrorMessage(error))
    }
  }

  function leave() {
    if (saving || confirming || confirmLeave) return
    if (isDirty) setConfirmLeave(true)
    else finishClose()
  }

  function finishClose() {
    setConfirmLeave(false)
    finishingExit.current = true
    setDialogOpen(false)
  }

  const [linkedAppointment, performed, requestedExams] = useWatch({
    control: form.control,
    name: ["appointmentId", "performedTreatments", "requestedExams"],
  })
  const performedTotal = sumCosts(performed)
  const usedProposals = performed.filter((item) => record.plan.some((proposal) => proposal.id === item.id)).length
  const confirmSummary = [
    performed.length === 0
      ? "No se registran tratamientos realizados."
      : performed.length === 1
        ? `Se registrará 1 tratamiento realizado por ${formatCurrency(performedTotal)}.`
        : `Se registrarán ${performed.length} tratamientos realizados por ${formatCurrency(performedTotal)}.`,
    usedProposals === 1 && "Saldrá 1 de los tratamientos propuestos.",
    usedProposals > 1 && `Saldrán ${usedProposals} de los tratamientos propuestos.`,
    requestedExams.length === 1 && "Quedará 1 examen solicitado como pendiente en la historia.",
    requestedExams.length > 1 && `Quedarán ${requestedExams.length} exámenes solicitados como pendientes en la historia.`,
    linkedAppointment && "La cita vinculada pasará a «Completada».",
  ]
    .filter(Boolean)
    .join(" ")


  return (
    <FormProvider {...form}>
      <EncounterRevealContext.Provider value={reveal}>
        <Dialog open={dialogOpen} disablePointerDismissal={saving} onOpenChange={(open, details) => {
          if (!open) { details.cancel(); leave() }
        }} onOpenChangeComplete={open => {
          if (!open && finishingExit.current) navigate(clinicalHistoryPath(patient.id))
        }}>
          <DialogContent className="clinic-encounter-dialog" showCloseButton={false} initialFocus={modalHeading}>
            <DialogHeader className="clinic-encounter-modal-heading">
              <div>
                <DialogTitle ref={modalHeading} tabIndex={-1}>Registrar atención</DialogTitle>
                <DialogDescription>
                  <span className="clinic-encounter-patient-name">{patientName}</span>
                  <span>Documento {patient.documentId}{age !== null && ` · ${age} años`}{patient.clinicalRecordNumber && ` · ${patient.clinicalRecordNumber}`}</span>
                </DialogDescription>
              </div>
              <DialogClose render={<Button type="button" variant="ghost" size="icon" aria-label="Cerrar registro de atención" disabled={saving} />}><X aria-hidden="true" /></DialogClose>
            </DialogHeader>

            <nav aria-label="Pasos de la atención" className="clinic-encounter-step-navigation">
              <p className="text-xs text-muted-foreground" aria-label="Paso actual">Paso {step + 1} de {encounterSteps.length}</p>
              <Select items={Object.fromEntries(encounterSteps.map(item => [item.id, item.label]))} value={current.id} disabled={saving}
                onValueChange={value => {
                  const index = encounterSteps.findIndex(item => item.id === value)
                  if (index >= 0 && index !== step) goToStep(index)
                }}>
                <SelectTrigger aria-label="Paso de la atención" className="clinic-encounter-step-selector"><SelectValue /></SelectTrigger>
                <SelectContent className="clinic-encounter-step-options" alignItemWithTrigger={false}>
                  {encounterSteps.map((item, index) => {
                    const error = errorSteps.has(index) && invalidSteps.has(index)
                    const complete = filledSteps.has(item.id) && !invalidSteps.has(index)
                    const state = index === step ? "active" : error ? "error" : complete ? "complete" : "pending"
                    return <SelectItem key={item.id} value={item.id} aria-label={`${index + 1}. ${item.label}`} data-state={state}
                      aria-describedby={`encounter-step-status-${item.id}`}>
                      <span className="clinic-encounter-step-option-number" aria-hidden="true">{index + 1}</span>
                      <span className="clinic-encounter-step-option-copy">{item.label}<small id={`encounter-step-status-${item.id}`}>{error ? "Con errores" : complete ? "Con datos válidos" : index === step ? "Actual" : "Pendiente"}</small></span>
                    </SelectItem>
                  })}
                </SelectContent>
              </Select>
            </nav>

            <div ref={scroll} className="clinic-encounter-scroll">
              <div className="clinic-encounter min-w-0 space-y-4">
                <MedicalAlerts source={record.allergiesAndMedication} />
                <section className="clinic-encounter-step-content" aria-labelledby="encounter-step-heading">
                  <div className="clinic-encounter-step-heading">
                    <h3 ref={heading} id="encounter-step-heading" tabIndex={-1}>Paso {step + 1} de {encounterSteps.length}: {current.label}</h3>
                    <p className="text-sm text-muted-foreground">Una vez guardada, la atención no se puede modificar. Para corregirla se agregan notas aclaratorias.</p>
                  </div>
                  <form id="register-encounter-form" noValidate aria-label={current.label} onSubmit={event => {
                    event.preventDefault()
                    if (current.id === "revision") void requestSave()
                    else void next()
                  }}>
                    <div data-encounter-step="motivo" hidden={current.id !== "motivo"} inert={current.id !== "motivo"}><StepReason appointmentOptions={appointmentOptions} /></div>
                    <div data-encounter-step="signos" hidden={current.id !== "signos"} inert={current.id !== "signos"}><StepVitals active={current.id === "signos"} /></div>
                    <div data-encounter-step="examen" hidden={current.id !== "examen"} inert={current.id !== "examen"}><StepExam /></div>
                    <div data-encounter-step="diagnostico" hidden={current.id !== "diagnostico"} inert={current.id !== "diagnostico"}><StepDiagnosis record={record} /></div>
                    <div data-encounter-step="tratamientos" hidden={current.id !== "tratamientos"} inert={current.id !== "tratamientos"}><StepTreatments proposed={record.plan} active={current.id === "tratamientos"} /></div>
                    <div data-encounter-step="revision" hidden={current.id !== "revision"} inert={current.id !== "revision"}>
                      {current.id === "revision" && <EncounterReview
                        professionalName={professionals?.find(item => item.id === draft.professionalId)?.name}
                        appointmentLabel={appointmentOptions.find(item => item.appointment.id === draft.appointmentId)?.label}
                        issues={issues.map(issue => ({ step: stepOfField(String(issue.path[0])), message: issue.message, field: issue.path.join(".") }))}
                        onEdit={(id, field) => goToStep(encounterSteps.findIndex(item => item.id === id), field)} />}
                    </div>
                  </form>
                </section>
                <ClinicalFormActions leading={<Button type="button" variant="outline" disabled={saving} onClick={leave}>Cancelar</Button>}>
                  {step > 0 && <Button type="button" variant="outline" disabled={saving} onClick={() => goToStep(step - 1)}><ChevronLeft />Anterior</Button>}
                  {current.id !== "revision" && <Button type="submit" form="register-encounter-form" variant="outline" className="clinic-clinical-next" disabled={saving}>Siguiente<ChevronRight /></Button>}
                  <Button type="button" disabled={saving} onClick={() => void requestSave()}>{saving ? "Guardando..." : "Guardar atención"}</Button>
                </ClinicalFormActions>
              </div>
            </div>
            <ConfirmDialog open={confirming} onOpenChange={open => !saving && setConfirming(open)} title="Guardar atención"
              description={`La atención no se podrá modificar después de guardarla. ${confirmSummary}`}
              confirmLabel="Confirmar y guardar" cancelLabel="Volver" isLoading={saving} onConfirm={() => void save()} />
            <ConfirmDialog open={confirmLeave} onOpenChange={setConfirmLeave} title="Salir sin guardar"
              description="Lo escrito en esta atención se perderá." confirmLabel="Salir sin guardar" cancelLabel="Seguir editando" destructive onConfirm={finishClose} />
          </DialogContent>
        </Dialog>
      </EncounterRevealContext.Provider>
    </FormProvider>
  )
}
