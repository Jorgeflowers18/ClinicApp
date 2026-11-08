import { useId, type ReactNode } from "react"
import { Controller, get, useFormContext } from "react-hook-form"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/**
 * Controles de los formularios de la historia y de la atención. Se conectan por nombre al
 * formulario del contexto (`useFormContext`), así sirven para los dos formularios.
 */

type Options = readonly (readonly [string, string])[]

function useFieldError(name: string): { message?: string } | undefined {
  const {
    formState: { errors },
  } = useFormContext()
  return get(errors, name)
}

interface ChoiceButtonsProps {
  label: string
  options: Options
  value: string
  onChange: (value: string) => void
  /** Volver a pulsar la opción elegida la quita (opciones no obligatorias). */
  allowClear?: boolean
  invalid?: boolean
  className?: string
}

/** Una sola opción entre pocas, como botones (Sí / No, Normal / Alterado…). */
export function ChoiceButtons({ label, options, value, onChange, allowClear = true, invalid, className }: ChoiceButtonsProps) {
  return (
    <div role="radiogroup" aria-label={label} aria-invalid={invalid || undefined} className={cn("flex flex-wrap gap-1", className)}>
      {options.map(([option, optionLabel]) => {
        const selected = value === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
              invalid && !selected && "border-destructive"
            )}
            onClick={() => onChange(selected && allowClear ? "" : option)}
          >
            {optionLabel}
          </button>
        )
      })}
    </div>
  )
}

/** `ChoiceButtons` conectado al formulario, con su etiqueta y su error. */
export function ChoiceField({
  name,
  label,
  options,
  allowClear,
  hideLabel,
  className,
}: {
  name: string
  label: string
  options: Options
  allowClear?: boolean
  hideLabel?: boolean
  className?: string
}) {
  const { control } = useFormContext()
  const error = useFieldError(name)
  return (
    <Field data-invalid={!!error} className={className}>
      {!hideLabel && <p className="text-sm font-medium">{label}</p>}
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <ChoiceButtons
            label={label}
            options={options}
            value={field.value ?? ""}
            allowClear={allowClear}
            invalid={!!error}
            onChange={(value) => field.onChange(value)}
          />
        )}
      />
      <FieldError errors={error ? [error] : undefined} />
    </Field>
  )
}

export function CheckboxItem({
  label,
  checked,
  onCheckedChange,
  ariaLabel,
  invalid,
  children,
}: {
  label: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  ariaLabel?: string
  invalid?: boolean
  children?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
        className="mt-0.5"
      />
      <div className="min-w-0 space-y-1">
        <label htmlFor={id} className="text-sm leading-tight">
          {label}
        </label>
        {children}
      </div>
    </div>
  )
}

/** Lista de casillas sobre un arreglo de claves del formulario. */
export function CheckboxListField({
  name,
  options,
  columns = 2,
}: {
  name: string
  options: Options
  columns?: 1 | 2 | 3
}) {
  const { control } = useFormContext()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const selected = new Set<string>(field.value ?? [])
        return (
          <div className={cn("grid gap-2.5", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3")}>
            {options.map(([key, label]) => (
              <CheckboxItem
                key={key}
                label={label}
                checked={selected.has(key)}
                onCheckedChange={(checked) =>
                  // Se conserva el orden de las opciones.
                  field.onChange(options.map(([option]) => option).filter((option) => (option === key ? checked : selected.has(option))))
                }
              />
            ))}
          </div>
        )
      }}
    />
  )
}

/** Número opcional: vacío es `null`. */
export function NumberField({
  name,
  label,
  unit,
  step = "1",
  min,
  max,
  className,
}: {
  name: string
  label: string
  unit?: string
  step?: string
  min?: number
  max?: number
  className?: string
}) {
  const { control } = useFormContext()
  const error = useFieldError(name)
  const id = useId()
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {unit && <span className="font-normal text-muted-foreground"> ({unit})</span>}
      </FieldLabel>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            step={step}
            min={min}
            max={max}
            aria-invalid={!!error}
            value={field.value ?? ""}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(event.target.value === "" ? null : Number(event.target.value))}
          />
        )}
      />
      <FieldError errors={error ? [error] : undefined} />
    </Field>
  )
}

export function TextField({
  name,
  label,
  placeholder,
  multiline,
  rows = 2,
  type = "text",
  className,
}: {
  name: string
  label: string
  placeholder?: string
  multiline?: boolean
  rows?: number
  type?: "text" | "date"
  className?: string
}) {
  const { register } = useFormContext()
  const error = useFieldError(name)
  const id = useId()
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea id={id} rows={rows} placeholder={placeholder} aria-invalid={!!error} {...register(name)} />
      ) : (
        <Input id={id} type={type} placeholder={placeholder} aria-invalid={!!error} {...register(name)} />
      )}
      <FieldError errors={error ? [error] : undefined} />
    </Field>
  )
}
