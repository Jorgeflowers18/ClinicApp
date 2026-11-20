import { useController, useFormContext } from "react-hook-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function InventoryField({ name, label, type = "text", hint, placeholder, min, step, options, disabled = false }: {
  name: string; label: string; type?: string; hint?: string; placeholder?: string; min?: number; step?: string; options?: { value: string; label: string }[]; disabled?: boolean
}) {
  const { control } = useFormContext()
  const { field, fieldState: { error } } = useController({ control, name })
  const describedBy = [error && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(" ") || undefined
  const props = { id: name, "aria-invalid": Boolean(error), "aria-describedby": describedBy, disabled, onBlur: field.onBlur, ref: field.ref }
  return <Field data-invalid={Boolean(error)}><FieldLabel htmlFor={name}>{label}</FieldLabel>
    {options ? <Select value={field.value || null} onValueChange={field.onChange} disabled={disabled} items={{ ...Object.fromEntries(options.map(option => [option.value, option.label])), ...(field.value && !options.some(option => option.value === field.value) ? { [field.value]: "Registro no disponible" } : {}) }}>
      <SelectTrigger {...props} className="w-full"><SelectValue placeholder={placeholder ?? "Selecciona..."} /></SelectTrigger><SelectContent className="inventory-select-options">{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select> : type === "textarea" ? <Textarea {...props} value={field.value ?? ""} onChange={field.onChange} rows={2} placeholder={placeholder} />
      : type === "number" ? <NumericInput {...props} prefix={name === "unitCost" || name.endsWith(".unitCost") ? "$" : undefined} min={min} step={step} value={field.value ?? ""} onChange={field.onChange} placeholder={placeholder} />
        : <Input {...props} type={type} min={min} step={step} value={field.value ?? ""} onChange={field.onChange} placeholder={placeholder} />}
    {hint && <FieldDescription id={`${name}-hint`}>{hint}</FieldDescription>}<FieldError id={`${name}-error`} errors={error ? [error] : undefined} />
  </Field>
}

export function InventoryFormError() {
  const { formState: { errors } } = useFormContext()
  const message = errors.root?.server?.message
  return message ? <Alert variant="destructive"><AlertTitle>No se pudo guardar</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null
}
