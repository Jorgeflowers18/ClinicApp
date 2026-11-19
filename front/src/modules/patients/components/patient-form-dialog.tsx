import { useRef, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import type { Patient } from "../types/patient.types"
import { PatientForm } from "./patient-form"

type PatientFormDialogProps = {
  initialSection?: string
  returnFocus: HTMLElement | null
  onClose: () => void
} & ({ mode: "create"; patient?: never } | { mode: "edit"; patient: Patient })

export function PatientFormDialog({ mode, patient, initialSection, returnFocus, onClose }: PatientFormDialogProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [dirty, setDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  function requestClose() {
    if (submitting) return
    if (dirty) setDiscarding(true)
    else onClose()
  }
  return <Dialog open disablePointerDismissal={submitting} onOpenChange={(open, details) => {
    if (!open) { details.cancel(); requestClose() }
  }}>
    <DialogContent variant="complex" className="patient-edit-dialog" showCloseButton={false} initialFocus={heading}
      finalFocus={() => returnFocus?.isConnected ? returnFocus : true}>
      <DialogHeader className="patient-edit-heading"><div>
        <DialogTitle ref={heading} tabIndex={-1}>{mode === "create" ? "Nuevo paciente" : "Editar paciente"}</DialogTitle>
        <DialogDescription>{patient ? `${patient.firstName} ${patient.lastName} · ${patient.documentId} · ${patient.clinicalRecordNumber}` : "Registra la información del paciente. Los campos con * son obligatorios."}</DialogDescription>
      </div><DialogClose render={<Button type="button" variant="ghost" size="icon" disabled={submitting} aria-label={mode === "create" ? "Cerrar creación de paciente" : "Cerrar edición de paciente"} />}><X aria-hidden="true" /></DialogClose></DialogHeader>
      <PatientForm patientId={patient?.id} presentation="dialog" initialSection={initialSection}
        onDirtyChange={setDirty} onSubmittingChange={setSubmitting} onCancel={requestClose} onSaved={onClose} />
      <ConfirmDialog open={discarding} onOpenChange={setDiscarding} title="¿Descartar los cambios?"
        description="Tienes modificaciones que todavía no se han guardado" cancelLabel="Continuar editando"
        confirmLabel="Descartar cambios" destructive onConfirm={onClose} />
    </DialogContent>
  </Dialog>
}
