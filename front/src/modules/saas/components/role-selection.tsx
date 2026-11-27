import { Badge } from "@/components/ui/badge"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AccessRole } from "../types"

/** Reuses the existing Select's multiple mode; no additional picker library. */
export function RoleSelection({ value, roles, onChange, error }: { value: string[]; roles: AccessRole[]; onChange: (ids: string[]) => void; error?: string }) {
  const options = roles.filter(role => role.active || value.includes(role.id))
  return <Field data-invalid={Boolean(error)}>
    <FieldLabel htmlFor="staff-accessRoleIds">Roles asignados *</FieldLabel>
    <Select multiple value={value} items={Object.fromEntries(options.map(role => [role.id, role.name]))} onValueChange={onChange}>
      <SelectTrigger id="staff-accessRoleIds" data-validation-field="accessRoleIds" className="w-full h-auto! min-h-8" aria-invalid={Boolean(error)} aria-describedby={error ? "staff-roles-error" : undefined}>
        <SelectValue placeholder="Seleccionar roles"><span className="saas-inline">{value.map(id => { const role = roles.find(item => item.id === id); return <Badge key={id} variant="secondary">{role?.name ?? "Rol no disponible"}{role && !role.active && " · inactivo"}</Badge> })}</span></SelectValue>
      </SelectTrigger>
      <SelectContent>{options.map(role => <SelectItem key={role.id} value={role.id} disabled={!role.active}>{role.name}{!role.active && " (inactivo)"}</SelectItem>)}</SelectContent>
    </Select>
    <FieldError id="staff-roles-error">{error}</FieldError>
  </Field>
}
