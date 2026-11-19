import { useState } from "react"
import { ResetFiltersButton } from "@/shared/components/reset-filters-button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import type { Professional } from "../types/appointment.types"

export const ALL_CALENDAR_PROFESSIONALS = "all"
export const ALL_CALENDAR_SPECIALTIES = "all"

type FilterOption = { value: string; label: string; description?: string }

function CalendarFilterSelect({ id, label, value, options, onChange, className = "" }: {
  id: string; label: string; value: string; options: FilterOption[]; onChange: (value: string) => void; className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.value === value)
  const selectedLabel = selected?.label ?? `${label} no disponible`
  return <div className={`clinic-calendar-filter-field ${className}`}>
    <Label htmlFor={id}>{label}</Label>
    <Select items={{ [value]: selectedLabel, ...Object.fromEntries(options.map(option => [option.value, option.label])) }} value={value} onValueChange={next => { if (next !== null) onChange(next) }} onOpenChange={setOpen}>
      <Tooltip disabled={open}>
        <TooltipTrigger render={<span className="min-w-0" />}>
          <SelectTrigger id={id} title={selectedLabel} className="clinic-calendar-filter-trigger"><SelectValue /></SelectTrigger>
        </TooltipTrigger>
        <TooltipContent className="clinic-calendar-filter-tooltip">{selectedLabel}</TooltipContent>
      </Tooltip>
      <SelectContent className="clinic-calendar-professional-options" align="start" side="bottom" alignItemWithTrigger={false}>
        {options.map(option => <SelectItem key={option.value} value={option.value} data-has-specialty={!!option.description || undefined}
          aria-label={option.description ? `${option.label}, ${option.description}` : option.label}
          title={option.description ? `${option.label} · ${option.description}` : option.label}>
          <span className="clinic-calendar-professional-option"><span className="clinic-calendar-professional-name">{option.label}</span>
            {option.description && <span className="clinic-calendar-professional-specialty">{option.description}</span>}
          </span>
        </SelectItem>)}
      </SelectContent>
    </Select>
  </div>
}

export function CalendarProfessionalFilters({ professionals, professional, specialty, onProfessionalChange, onSpecialtyChange, onClear }: {
  professionals: readonly Professional[]
  professional: string
  specialty: string
  onProfessionalChange: (id: string) => void
  onSpecialtyChange: (specialty: string) => void
  onClear: () => void
}) {
  const [pendingSpecialty, setPendingSpecialty] = useState<string | null>(null)
  const specialties = [...new Set(professionals.map(item => item.specialty?.trim()).filter((value): value is string => !!value))]
  const availableProfessionals = specialty === ALL_CALENDAR_SPECIALTIES ? professionals : professionals.filter(item => item.specialty?.trim() === specialty)
  const selectedProfessional = professionals.find(item => item.id === professional)
  function requestSpecialty(next: string) {
    if (next !== ALL_CALENDAR_SPECIALTIES && selectedProfessional && selectedProfessional.specialty?.trim() !== next) setPendingSpecialty(next)
    else onSpecialtyChange(next)
  }
  const active = professional !== ALL_CALENDAR_PROFESSIONALS || specialty !== ALL_CALENDAR_SPECIALTIES
  return <>
    <div className="clinic-calendar-filters" role="group" aria-label="Filtros de odontólogos">
      <CalendarFilterSelect id="professionalFilter" label="Profesional" value={professional} onChange={onProfessionalChange}
        options={[{ value: ALL_CALENDAR_PROFESSIONALS, label: "Todos los profesionales" }, ...availableProfessionals.map(item => ({ value: item.id, label: item.name, description: item.specialty?.trim() || undefined }))]} />
      {specialties.length > 0 && <CalendarFilterSelect id="specialtyFilter" label="Especialidad" value={specialty} onChange={requestSpecialty} className="clinic-calendar-specialty-filter"
        options={[{ value: ALL_CALENDAR_SPECIALTIES, label: "Todas las especialidades" }, ...specialties.map(value => ({ value, label: value }))]} />}
      <ResetFiltersButton disabled={!active} onReset={onClear} className="clinic-calendar-clear" />
    </div>
    <ConfirmDialog open={pendingSpecialty !== null} onOpenChange={open => { if (!open) setPendingSpecialty(null) }}
      title="Cambiar filtro de especialidad"
      description={`${selectedProfessional?.name ?? "El profesional seleccionado"} no pertenece a ${pendingSpecialty ?? "esa especialidad"}. Al continuar se mostrarán todos los profesionales de la especialidad elegida.`}
      cancelLabel="Conservar profesional" confirmLabel="Cambiar especialidad" onConfirm={() => {
        if (pendingSpecialty === null) return
        onProfessionalChange(ALL_CALENDAR_PROFESSIONALS)
        onSpecialtyChange(pendingSpecialty)
        setPendingSpecialty(null)
      }} />
  </>
}
