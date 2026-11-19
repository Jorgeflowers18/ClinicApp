import { useRef, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import "../appointment-dialogs.css"

/** Presentation and draft protection shared by appointment and schedule-block forms. */
export function ScheduleFormDialog({ open, onOpenChange, title, description, dirty, busy, children }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  dirty: boolean
  busy: boolean
  children: (requestClose: () => void) => ReactNode
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [discarding, setDiscarding] = useState(false)
  function requestClose() {
    if (busy) return
    if (dirty) setDiscarding(true)
    else onOpenChange(false)
  }
  return <Dialog open={open} disablePointerDismissal={busy} onOpenChange={(next, details) => {
    if (!next) { details.cancel(); requestClose() }
  }}>
    <DialogContent className="clinic-schedule-dialog" showCloseButton={false} initialFocus={heading}>
      <DialogHeader className="clinic-schedule-heading"><div>
        <DialogTitle ref={heading} tabIndex={-1}>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </div><Button type="button" variant="ghost" size="icon" aria-label={`Cerrar ${title.toLocaleLowerCase("es")}`} disabled={busy} onClick={requestClose}><X aria-hidden="true" /></Button></DialogHeader>
      {children(requestClose)}
      <ConfirmDialog open={open && discarding} onOpenChange={setDiscarding} title="¿Descartar los cambios?"
        description="Tienes modificaciones que todavía no se han guardado." cancelLabel="Continuar editando"
        confirmLabel="Descartar cambios" destructive onConfirm={() => { setDiscarding(false); onOpenChange(false) }} />
    </DialogContent>
  </Dialog>
}
