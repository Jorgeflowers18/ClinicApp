import { useEffect, useId, useState } from "react"
import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { assertUsernameAvailable, demoReadError } from "../adapters/demo-repository"
import { suggestUsername, usernameSchema } from "../lib/identity"
import { accountStates, professionalStates, type AccountState, type ProfessionalState } from "../types"

export function SaasSelect({ label, value, items, onChange, id, disabled, error }: {
  label: string; value: string; items: Record<string, string>; onChange: (value: string) => void; id?: string; disabled?: boolean; error?: string
}) {
  const generated = useId(), target = id ?? generated
  return <Field className="saas-field" data-invalid={Boolean(error)}>
    <FieldLabel htmlFor={target}>{label}</FieldLabel>
    <Select value={value} items={items} disabled={disabled} onValueChange={next => next && onChange(next)}>
      <SelectTrigger id={target} data-validation-field={id} className="w-full" aria-invalid={Boolean(error)} aria-describedby={error ? target + "-error" : undefined}><SelectValue /></SelectTrigger>
      <SelectContent>{Object.entries(items).map(([key, text]) => <SelectItem value={key} key={key}>{text}</SelectItem>)}</SelectContent>
    </Select>
    <FieldError id={target + "-error"}>{error}</FieldError>
  </Field>
}
export function UsernameField({ value, onChange, firstName = "", lastName = "", accountId, error, required = false, readOnly = false, availability = true }: {
  value: string; onChange: (value: string) => void; firstName?: string; lastName?: string; accountId?: string; error?: string; required?: boolean; readOnly?: boolean; availability?: boolean
}) {
  const id = useId(), [status, setStatus] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!availability || !value || !usernameSchema.safeParse(value).success) { setStatus(""); return }
      try { assertUsernameAvailable(value, accountId); setStatus("Disponible localmente.") }
      catch { setStatus("Este nombre no está disponible localmente.") }
    }, 500)
    return () => clearTimeout(timer)
  }, [value, accountId, availability])
  return <Field data-invalid={Boolean(error)}>
    <FieldLabel htmlFor={id}>Nombre de usuario{required && " *"}</FieldLabel>
    <div className="saas-inline"><Input id={id} name="username" data-validation-field="username" value={value} onChange={event => onChange(event.target.value)} placeholder="Elige tu nombre de usuario" autoComplete="username" readOnly={readOnly} aria-invalid={Boolean(error)} aria-describedby={id + "-help" + (error ? " " + id + "-error" : "")} aria-required={required} />
      {!readOnly && firstName && <Button type="button" variant="outline" size="sm" onClick={() => onChange(suggestUsername(firstName, lastName))}>Sugerir</Button>}
    </div>
    <p id={id + "-help"} className="saas-hint">{readOnly ? "Identificador asignado. Su modificación requiere administración." : "3–30 caracteres. Letras, números, punto, guion o guion bajo."}</p>
    {status && <small role="status">{status}</small>}<FieldError id={id + "-error"}>{error}</FieldError>
  </Field>
}
export function AccountStatusBadge({ state }: { state: AccountState }) {
  const tones = { active: "success", inactive: "muted", blocked: "danger", pending: "warning" }
  return <Badge variant="outline" className="saas-status-badge" data-status-kind="account" data-status={state} data-tone={tones[state]}>{accountStates[state]}</Badge>
}
export function ProfessionalStatusBadge({ state }: { state: ProfessionalState }) {
  const tones = { ACTIVE: "success", INACTIVE: "muted", VACATION: "vacation", LEAVE: "warning", RETIRED: "retired" }
  return <Badge variant="outline" className="saas-status-badge" data-status-kind="professional" data-status={state} data-tone={tones[state]}>{professionalStates[state]}</Badge>
}
export function DemoNotice() {
  const error = demoReadError()
  if (error) return <p className="saas-hint text-destructive" role="alert">{error}</p>
  return <div className="saas-demo-label"><Tooltip>
    <TooltipTrigger render={<button type="button" className="saas-demo-trigger" aria-label="Información sobre los datos de demostración" />}><Info aria-hidden="true" />Datos de demostración</TooltipTrigger>
    <TooltipContent>Los cambios de esta sección se almacenan localmente y no se sincronizan con el servidor.</TooltipContent>
  </Tooltip></div>
}
