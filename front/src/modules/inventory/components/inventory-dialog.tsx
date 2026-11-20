import { useEffect, useRef, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import "../inventory.css"

export function InventoryConfirmDialog({ open, onOpenChange, title, description, onConfirm, pending = false, destructive = false, confirmLabel = "Confirmar", cancelLabel = "Cancelar", returnFocus }: {
  open: boolean; onOpenChange: (value: boolean) => void; title: string; description: ReactNode; onConfirm: () => void; pending?: boolean; destructive?: boolean; confirmLabel?: string; cancelLabel?: string; returnFocus?: () => HTMLElement | null
}) {
  const cancelButton = useRef<HTMLButtonElement>(null)
  return <AlertDialog open={open} onOpenChange={value => { if(!pending) onOpenChange(value) }}>
    <AlertDialogContent className="inventory-confirm" initialFocus={cancelButton} finalFocus={returnFocus ?? true}>
      <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
      <div className="inventory-form-actions"><Button ref={cancelButton} variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>{cancelLabel}</Button><Button variant={destructive ? "destructive" : "default"} disabled={pending} onClick={onConfirm}>{pending ? "Procesando..." : confirmLabel}</Button></div>
    </AlertDialogContent>
  </AlertDialog>
}

/** Mounted once per opening; short and complex forms share focus, dismissal and scrolling. */
export function InventoryDialog({ title, description, size = "item", dirty = false, pending = false, onClose, returnFocus, children }: {
  returnFocus?: () => HTMLElement | null
  title: string; description: ReactNode; size?: "movement" | "item" | "supplier" | "purchase" | "purchase-detail" | "cycle"; dirty?: boolean; pending?: boolean; onClose: () => void
  children: (actions: { close: () => void; cancel: () => void }) => ReactNode
}) {
  const [open, setOpen] = useState(true)
  const [discard, setDiscard] = useState(false)
  const [origin] = useState(() => document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const heading = useRef<HTMLHeadingElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)
  const close = () => { setDiscard(false); setOpen(false) }
  const cancel = () => { if(pending || discard) return; if(dirty) setDiscard(true); else close() }
  useEffect(() => {
    if(!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  return <Dialog open={open} disablePointerDismissal={pending} onOpenChange={(next, details) => { if(!next) { details.cancel(); cancel() } }} onOpenChangeComplete={next => { if(!next) onClose() }}>
    <DialogContent variant={size === "movement" ? "small" : size === "purchase" ? "complex" : size === "cycle" || size === "purchase-detail" ? "wide" : "medium"} className={`inventory-dialog inventory-dialog-${size}`} showCloseButton={false} initialFocus={heading} onFocusCapture={event => { if(event.currentTarget.contains(event.target)) lastFocus.current = event.target as HTMLElement }} finalFocus={() => { const target = returnFocus?.() ?? origin; return target?.isConnected && target !== document.body ? target : document.querySelector<HTMLElement>('.inventory-module [data-slot="tabs-content"]:not([hidden]) [data-inventory-create]') ?? true }}>
      <DialogHeader className="inventory-dialog-heading"><div><DialogTitle ref={heading} tabIndex={-1}>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></div><DialogClose render={<Button type="button" variant="ghost" size="icon" disabled={pending} aria-label="Cerrar formulario de inventario" />}><X aria-hidden="true" /></DialogClose></DialogHeader>
      <div className="inventory-dialog-scroll">{children({ close, cancel })}</div>
      <InventoryConfirmDialog open={discard} onOpenChange={setDiscard} returnFocus={() => lastFocus.current?.isConnected ? lastFocus.current : heading.current} title="¿Descartar los cambios?" description="Hay cambios sin guardar. Puedes continuar editando o salir sin guardarlos." confirmLabel="Descartar cambios" cancelLabel="Continuar editando" destructive onConfirm={close} />
    </DialogContent>
  </Dialog>
}
