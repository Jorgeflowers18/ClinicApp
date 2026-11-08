import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, ArrowRight, Check, Pencil } from "lucide-react"
import { FormProvider, useForm, useWatch, type FieldPath, type Path } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { calculateAge } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { createId } from "@/shared/lib/id"
import { formatCurrency } from "@/shared/lib/number"
import { cn } from "@/lib/utils"
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
import { EncounterSummary } from "./encounter-summary"
import { StepDiagnosis } from "./encounter-steps/step-diagnosis"
import { StepExam } from "./encounter-steps/step-exam"
import { StepReason } from "./encounter-steps/step-reason"
import { StepTreatments } from "./encounter-steps/step-treatments"
import { StepVitals } from "./encounter-steps/step-vitals"
import { MedicalAlerts } from "./medical-alerts"

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

  function goToStep(index: number) {
    setStep(index)
    window.scrollTo({ top: 0 })
  }

  async function next() {
    const valid = await form.trigger(stepFields[current.id])
    if (!valid) {
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
      if (first !== undefined) goToStep(first)
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
        if (target >= 0) goToStep(target)
      }
      toast.error(getErrorMessage(error))
    }
  }

  function leave() {
    if (isDirty) setConfirmLeave(true)
    else navigate(clinicalHistoryPath(patient.id))
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
      <div className="min-w-0 space-y-5">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={leave}>
            <ArrowLeft />
            Volver a la historia
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Registrar atención</h1>
            <p className="text-sm text-muted-foreground">
              {patientName} · Cédula {patient.documentId}
              {age !== null && ` · ${age} años`}
              {patient.clinicalRecordNumber && ` · ${patient.clinicalRecordNumber}`}
            </p>
          </div>
          <MedicalAlerts source={record.allergiesAndMedication} />
        </div>

        <nav aria-label="Pasos de la atención" className="overflow-x-auto">
          <ol className="flex min-w-max gap-2">
            {encounterSteps.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => goToStep(index)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    index === step ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    index < step && "border-primary/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-xs font-medium",
                      index === step ? "bg-primary-foreground text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {index < step ? <Check className="size-3" /> : index + 1}
                  </span>
                  {item.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <Card>
          <CardHeader>
            <CardTitle>
              Paso {step + 1} de {encounterSteps.length}: {current.label}
            </CardTitle>
            <CardDescription>
              Una vez guardada, la atención no se puede modificar. Para corregirla se agregan notas aclaratorias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              id="register-encounter-form"
              noValidate
              aria-label={current.label}
              onSubmit={(event) => {
                event.preventDefault()
                if (current.id === "revision") void requestSave()
                else void next()
              }}
            >
              {current.id === "motivo" && <StepReason appointmentOptions={appointmentOptions} />}
              {current.id === "signos" && <StepVitals />}
              {current.id === "examen" && <StepExam />}
              {current.id === "diagnostico" && <StepDiagnosis record={record} />}
              {current.id === "tratamientos" && <StepTreatments proposed={record.plan} />}
              {current.id === "revision" && (
                <ReviewStep
                  professionalName={professionals?.find((item) => item.id === getValues("professionalId"))?.name}
                  onEdit={(id) => goToStep(encounterSteps.findIndex((item) => item.id === id))}
                />
              )}
            </form>
          </CardContent>
        </Card>

        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3 shadow-lg">
          <Button type="button" variant="outline" disabled={saving} onClick={leave}>
            Cancelar
          </Button>
          <div className="flex flex-wrap gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" disabled={saving} onClick={() => goToStep(step - 1)}>
                <ArrowLeft />
                Anterior
              </Button>
            )}
            {current.id !== "revision" && (
              <Button type="submit" form="register-encounter-form" variant="secondary" disabled={saving}>
                Siguiente
                <ArrowRight />
              </Button>
            )}
            <Button type="button" disabled={saving} onClick={() => void requestSave()}>
              {saving ? "Guardando..." : "Guardar atención"}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !saving && setConfirming(open)}
        title="Guardar atención"
        description={`La atención no se podrá modificar después de guardarla. ${confirmSummary}`}
        confirmLabel="Confirmar y guardar"
        cancelLabel="Volver"
        isLoading={saving}
        onConfirm={() => void save()}
      />
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Salir sin guardar"
        description="Lo escrito en esta atención se perderá."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => navigate(clinicalHistoryPath(patient.id))}
      />
    </FormProvider>
  )
}

function ReviewStep({ professionalName, onEdit }: { professionalName?: string; onEdit: (step: EncounterStepId) => void }) {
  const values = useWatch() as EncounterFormValues
  const sections = encounterSections(values)
  const total = sumCosts(values.performedTreatments)
  return (
    <div className="space-y-4">
      <p className="text-sm">
        <strong>Fecha:</strong> {values.date || "—"} · <strong>Profesional:</strong> {professionalName ?? "Sin asignar"}
      </p>
      <EncounterSummary
        sections={sections}
        action={(section) => (
          <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(section.step)}>
            <Pencil />
            Editar
          </Button>
        )}
      />
      <section aria-label="Tratamientos realizados" className="space-y-1.5">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tratamientos realizados</h4>
        {values.performedTreatments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se registran tratamientos realizados.</p>
        ) : (
          <ul className="text-sm">
            {values.performedTreatments.map((item) => (
              <li key={item.id}>
                {item.description}
                {item.tooth && ` (${item.tooth})`} · {formatCurrency(Number.isFinite(item.cost) ? item.cost : 0)}
              </li>
            ))}
            <li className="font-medium">Total {formatCurrency(total)}</li>
          </ul>
        )}
      </section>
    </div>
  )
}
