import { useState } from "react"
import { Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDateTime } from "@/shared/lib/date"

import type { PasswordLink } from "../types/user-admin.types"

interface PasswordLinkDialogProps {
  /** El enlace y para quién es; `null` cierra el diálogo. */
  value: { name: string; link: PasswordLink } | null
  onClose: () => void
}

/**
 * Muestra una sola vez el enlace para elegir la contraseña. Mientras no haya proveedor de correo, el admin se lo
 * pasa a la persona por su cuenta.
 */
export function PasswordLinkDialog({ value, onClose }: PasswordLinkDialogProps) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value.link.url)
      setCopied(true)
      toast.success("Enlace copiado")
    } catch {
      toast.error("No se pudo copiar: selecciona el enlace y cópialo a mano.")
    }
  }
  return <Dialog open={Boolean(value)} onOpenChange={(open) => { if (!open) { setCopied(false); onClose() } }}>
    <DialogContent variant="medium">
      <DialogHeader>
        <DialogTitle>Enlace para elegir la contraseña</DialogTitle>
        <DialogDescription>
          Pásale este enlace a {value?.name}. Sirve una sola vez y vale hasta el {value ? formatDateTime(value.link.expiresAt, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}.
          No se vuelve a mostrar: si se pierde, genera uno nuevo desde su cuenta.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="passwordLinkUrl">Enlace</Label>
        <div className="flex gap-2">
          <Input id="passwordLinkUrl" readOnly value={value?.link.url ?? ""} onFocus={(event) => event.currentTarget.select()} />
          <Button type="button" variant="outline" onClick={() => void copy()}><Copy aria-hidden="true" />{copied ? "Copiado" : "Copiar"}</Button>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" onClick={() => { setCopied(false); onClose() }}>Listo</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
