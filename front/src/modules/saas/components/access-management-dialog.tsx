import { useRef, useState } from "react"
import { KeyRound, LockKeyhole, Mail, ShieldCheck, UnlockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getErrorMessage } from "@/shared/lib/error-message"
import { demoStaffAdapter } from "../services"
import { nameOf } from "../lib/identity"
import { useSessionUser } from "../state"
import type { StaffUser } from "../types"
import { AccountStatusBadge } from "./controls"

type Action = "invitation" | "reset" | "password" | "block" | "unblock"
const labels = { invitation: "Reenviar invitación", reset: "Restablecer acceso", password: "Solicitar cambio de contraseña", block: "Bloquear cuenta", unblock: "Desbloquear cuenta" }
const icons = { invitation: Mail, reset: KeyRound, password: ShieldCheck, block: LockKeyhole, unblock: UnlockKeyhole }
export function AccessManagementDialog({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const [selected, setSelected] = useState<Action | null>(null), [failure, setFailure] = useState(""), [done, setDone] = useState(false), [busy, setBusy] = useState(false)
  const lock = useRef(false), actor = useSessionUser()
  const actions: Action[] = user.state === "blocked" ? ["unblock"]
    : user.state === "inactive" ? [] : user.state === "pending" ? ["invitation", "block"] : ["reset", "password", "block"]
  async function confirm() {
    if (!selected || lock.current) return
    lock.current = true; setBusy(true); setFailure("")
    try {
      const next = { ...user }
      if (selected === "block") next.state = "blocked"
      if (selected === "unblock") next.state = user.activation === "invitation" ? "pending" : "active"
      if (selected === "invitation") next.activation = "invitation"
      if (selected === "reset" || selected === "password") next.mustChangePassword = true
      await demoStaffAdapter.saveUser(next)
      setSelected(null); setDone(true)
    } catch (error) { setFailure(getErrorMessage(error)) }
    finally { lock.current = false; setBusy(false) }
  }
  return <Dialog open onOpenChange={open => !open && !busy && onClose()}>
    <DialogContent className="saas-scope">
      <DialogHeader><DialogTitle>Gestionar acceso</DialogTitle><DialogDescription>{nameOf(user)} · {user.username}</DialogDescription></DialogHeader>
      <DialogBody className="saas-stack">
        <div><AccountStatusBadge state={user.state} /></div>
        <p className="saas-hint">Estas acciones actualizan el acceso de demostración. No envían correos ni cambian contraseñas en el servidor.</p>
        {actions.map(action => {
          const Icon = icons[action]
          return <Button key={action} type="button" variant={selected === action ? "secondary" : "outline"}
            className="saas-access-choice" disabled={busy || action === "block" && user.id === actor?.id}
            aria-pressed={selected === action} onClick={() => { setSelected(action); setFailure(""); setDone(false) }}>
            <Icon aria-hidden="true" />{labels[action]}
          </Button>
        })}
        {!actions.length && <p>Reactiva esta cuenta desde su menú de usuario para gestionar el acceso.</p>}
        {selected && <p className="saas-hint">Confirma «{labels[selected]}» para {user.username}. Se conservarán su identidad y sus registros.</p>}
        {failure && <p role="alert" className="text-destructive">{failure}</p>}
        {done && <p role="status">Acceso actualizado en la demostración.</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onClose}>Cerrar</Button>
        {selected && <Button disabled={busy} variant={selected === "block" ? "destructive" : "default"} onClick={() => void confirm()}>{busy ? "Actualizando…" : "Confirmar acción"}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
