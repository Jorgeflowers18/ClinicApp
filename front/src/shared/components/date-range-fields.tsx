import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/** Presentation of the existing native min/max relationship; no query or validation rule changes. */
export function DateRangeFields({ fromId: providedFromId, toId: providedToId, from, to, disabled, onFromChange, onToChange }: {
  fromId?: string; toId?: string; from: string; to: string; disabled?: boolean
  onFromChange: (date: string) => void; onToChange: (date: string) => void
}) {
  const id = useId(), fromId = providedFromId ?? `${id}-from`, toId = providedToId ?? `${id}-to`
  const error = !disabled && from && to && from > to ? "La fecha inicial no puede ser posterior a la fecha final." : undefined
  return <>
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={fromId}>Desde</FieldLabel>
      <Input id={fromId} type="date" value={from} max={to || undefined} disabled={disabled} aria-invalid={!!error} onChange={event => onFromChange(event.target.value)} />
      <FieldError>{error}</FieldError>
    </Field>
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={toId}>Hasta</FieldLabel>
      <Input id={toId} type="date" value={to} min={from || undefined} disabled={disabled} aria-invalid={!!error} onChange={event => onToChange(event.target.value)} />
      <FieldError>{error}</FieldError>
    </Field>
  </>
}
import { useId } from "react"
