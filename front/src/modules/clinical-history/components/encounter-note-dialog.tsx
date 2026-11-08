import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useAuthStore } from "@/modules/auth/store/auth-store"

import { useAddEncounterNote } from "../api/clinical-history.queries"
import { encounterNoteSchema, type ClinicalEncounter, type EncounterNoteFormValues } from "../types/clinical-history.types"

interface EncounterNoteDialogProps {
  patientId: string
  /** Atención a la que se agrega la nota; `null` cierra el diálogo. */
  encounter: ClinicalEncounter | null
  onClose: () => void
}

/** Nota aclaratoria de una atención ya guardada. Se confirma antes de guardarse y no se edita después. */
export function EncounterNoteDialog({ patientId, encounter, onClose }: EncounterNoteDialogProps) {
  const authorName = useAuthStore((state) => state.user?.name) ?? "Usuario"
  const addNote = useAddEncounterNote(patientId)
  const [confirming, setConfirming] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<EncounterNoteFormValues>({
    resolver: zodResolver(encounterNoteSchema),
    defaultValues: { text: "" },
  })

  function close() {
    reset({ text: "" })
    onClose()
  }

  async function save() {
    if (!encounter) return
    try {
      await addNote.mutateAsync({ encounterId: encounter.id, input: { text: getValues("text"), authorName } })
      setConfirming(false)
      toast.success("Nota aclaratoria agregada")
      close()
    } catch (error) {
      setConfirming(false)
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <>
      <Dialog open={Boolean(encounter)} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar nota aclaratoria</DialogTitle>
            <DialogDescription>
              {encounter &&
                `Atención del ${formatDateOnly(encounter.date, { day: "2-digit", month: "long", year: "numeric" })}. `}
              La atención original no cambia: la nota queda debajo, con tu nombre y la fecha.
            </DialogDescription>
          </DialogHeader>
          <form id="encounter-note-form" onSubmit={handleSubmit(() => setConfirming(true))}>
            <Field data-invalid={!!errors.text}>
              <FieldLabel htmlFor="encounter-note-text">Nota</FieldLabel>
              <Textarea id="encounter-note-text" rows={4} aria-invalid={!!errors.text} {...register("text")} />
              <FieldDescription>Registrada por {authorName}.</FieldDescription>
              <FieldError errors={errors.text ? [errors.text] : undefined} />
            </Field>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" form="encounter-note-form">
              Guardar nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !addNote.isPending && setConfirming(open)}
        title="Guardar nota aclaratoria"
        description="La nota no se podrá modificar ni eliminar después de guardarla."
        confirmLabel="Confirmar y guardar"
        cancelLabel="Volver"
        isLoading={addNote.isPending}
        onConfirm={() => void save()}
      />
    </>
  )
}
