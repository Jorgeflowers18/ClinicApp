import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Info } from "lucide-react"
import { FormProvider, useForm, useWatch, type Path } from "react-hook-form"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { getErrorMessage } from "@/shared/lib/error-message"
import { formatCurrency } from "@/shared/lib/number"
import { ApiError } from "@/shared/types/common"

import { useDefaultProfessionalId } from "../hooks/use-default-professional"
import { usePatientAppointmentOptions } from "../hooks/use-patient-appointment-options"
import { today } from "../lib/record"
import {
  encounterFormSchema,
  type ClinicalEncounter,
  type EncounterFormValues,
  type ProposedTreatment,
} from "../types/clinical-history.types"
import { EncounterFields } from "./encounter-fields"
import { PerformedTreatmentsField } from "./performed-treatments-field"

const emptyValues = (): EncounterFormValues => ({
  date: today(),
  professionalId: "",
  appointmentId: null,
  reason: "",
  diagnosis: "",
  procedures: "",
  evolution: "",
  notes: "",
  nextVisit: "",
  performedTreatments: [],
})

interface RegisterEncounterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  encounters: ClinicalEncounter[]
  /** Cita elegida al abrir (`?cita=` o pestaña Citas); se preselecciona si sigue disponible. */
  appointmentId: string | null
  /** Tratamientos propuestos de la historia (tal como están en pantalla), ofrecidos como atajo. */
  proposed: ProposedTreatment[]
  /** Secciones de la historia con cambios sin guardar; vacío si no hay. */
  pendingChanges: string
  /** Valida los cambios pendientes de la historia antes de confirmar; `false` si tienen errores. */
  validateRecord: () => Promise<boolean>
  /** Ejecuta la secuencia de guardado. Lanza el error si falla. */
  onRegister: (values: EncounterFormValues) => Promise<void>
}

/**
 * Formulario de una atención nueva. El formulario vive fuera del contenido del diálogo: si se cierra
 * para corregir la historia, lo escrito se conserva hasta guardar o cancelar.
 */
export function RegisterEncounterDialog({
  open,
  onOpenChange,
  patientId,
  encounters,
  appointmentId,
  proposed,
  pendingChanges,
  validateRecord,
  onRegister,
}: RegisterEncounterDialogProps) {
  const form = useForm<EncounterFormValues>({
    resolver: zodResolver(encounterFormSchema),
    defaultValues: emptyValues(),
  })
  const { options } = usePatientAppointmentOptions(patientId, encounters)
  // Una atención no puede tener fecha futura: solo se ofrecen las citas de hoy o anteriores.
  const appointmentOptions = useMemo(() => options.filter((option) => option.date <= today()), [options])
  const defaultProfessionalId = useDefaultProfessionalId()
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const { getValues, setValue } = form
  // Cada cita se preselecciona una sola vez: si el usuario la quita, no vuelve hasta elegirla de nuevo.
  const appliedAppointmentId = useRef<string | null>(null)

  // Las citas y los profesionales llegan de forma asíncrona: se completan solo si el usuario no eligió nada.
  useEffect(() => {
    if (!open) return
    const preselected = appointmentOptions.find((option) => option.appointment.id === appointmentId)
    if (preselected && appliedAppointmentId.current !== preselected.appointment.id) {
      appliedAppointmentId.current = preselected.appointment.id
      setValue("appointmentId", preselected.appointment.id)
      setValue("professionalId", preselected.appointment.professionalId)
      setValue("date", preselected.date)
      return
    }
    if (!getValues("professionalId") && defaultProfessionalId) setValue("professionalId", defaultProfessionalId)
  }, [open, appointmentOptions, appointmentId, defaultProfessionalId, getValues, setValue])

  function resetForm() {
    appliedAppointmentId.current = null
    form.reset(emptyValues())
  }

  function cancel() {
    resetForm()
    onOpenChange(false)
  }

  async function requestConfirm() {
    const valid = await form.trigger()
    if (!valid) {
      toast.error("Revisa los campos marcados de la atención")
      return
    }
    if (await validateRecord()) setConfirming(true)
  }

  async function confirm() {
    setSaving(true)
    try {
      await onRegister(form.getValues())
      setConfirming(false)
      resetForm()
      onOpenChange(false)
    } catch (error) {
      setConfirming(false)
      if (error instanceof ApiError && error.fieldErrors?.length) {
        error.fieldErrors.forEach(({ field, message }) =>
          form.setError(field as Path<EncounterFormValues>, { type: "server", message })
        )
      }
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const [linkedAppointment, performed] = useWatch({
    control: form.control,
    name: ["appointmentId", "performedTreatments"],
  })
  const performedTotal = performed.reduce((sum, item) => sum + item.cost, 0)
  const usedProposals = performed.filter((item) => proposed.some((proposal) => proposal.id === item.id)).length
  const treatmentsSummary = [
    performed.length === 0
      ? "No se registran tratamientos realizados."
      : performed.length === 1
        ? `Se registrará 1 tratamiento realizado por ${formatCurrency(performedTotal)}.`
        : `Se registrarán ${performed.length} tratamientos realizados por ${formatCurrency(performedTotal)}.`,
    usedProposals === 1 && "Saldrá 1 de los tratamientos propuestos.",
    usedProposals > 1 && `Saldrán ${usedProposals} de los tratamientos propuestos.`,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <FormProvider {...form}>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : cancel())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Registrar atención</DialogTitle>
            <DialogDescription>
              Una vez guardada, la atención no se puede modificar. Para corregirla se agregan notas aclaratorias.
            </DialogDescription>
          </DialogHeader>

          {pendingChanges && (
            <Alert>
              <Info />
              <AlertTitle>La historia tiene cambios sin guardar</AlertTitle>
              <AlertDescription>
                Los cambios en {pendingChanges} se guardarán junto con la atención, para que la copia del odontograma
                refleje lo que ves en pantalla.
              </AlertDescription>
            </Alert>
          )}

          <form
            id="register-encounter-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void requestConfirm()
            }}
          >
            <div className="space-y-6">
              <EncounterFields appointmentOptions={appointmentOptions} />
              <PerformedTreatmentsField proposed={proposed} />
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={cancel}>
              Cancelar
            </Button>
            <Button type="submit" form="register-encounter-form" disabled={saving}>
              {saving ? "Guardando..." : "Guardar atención"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => !saving && setConfirming(next)}
        title="Guardar atención"
        description={
          <>
            La atención no se podrá modificar después de guardarla.
            {` ${treatmentsSummary}`}
            {linkedAppointment && " La cita vinculada pasará a «Completada»."}
            {pendingChanges && ` También se guardarán los cambios pendientes de la historia (${pendingChanges}).`}
          </>
        }
        confirmLabel="Confirmar y guardar"
        cancelLabel="Volver"
        isLoading={saving}
        onConfirm={() => void confirm()}
      />
    </FormProvider>
  )
}
