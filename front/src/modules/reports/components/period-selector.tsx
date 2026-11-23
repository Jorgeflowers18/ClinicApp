import { CalendarDays } from "lucide-react"
import { ResetFiltersButton } from "@/shared/components/reset-filters-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDateOnly } from "@/shared/lib/date"
import { getPresetPeriod, type PeriodError } from "../lib/period"
import { reportPeriodPresetLabels, reportPeriodPresets, type ReportPeriodPreset, type ReportPeriodState } from "../types/report.types"

interface PeriodSelectorProps {
  value: ReportPeriodState
  onChange: (next: ReportPeriodState) => void
  /** Periodo inválido (reglas del back, o el `400` que devolvió): se muestra junto a las fechas. */
  error?: PeriodError | null
}
export function PeriodSelector({ value, onChange, error }: PeriodSelectorProps) {
  const isCustom = value.preset === "custom"
  function handlePresetChange(preset: ReportPeriodPreset) {
    onChange({ preset, period: preset === "custom" ? value.period : getPresetPeriod(preset) })
  }
  function handleDateChange(field: "from" | "to", date: string) {
    if (!date) return
    onChange({ preset: "custom", period: { ...value.period, [field]: date } })
  }
  function clearFilters() {
    const preset: ReportPeriodPreset = "last30"
    onChange({ preset, period: getPresetPeriod(preset) })
  }
  const fullRange = formatDateOnly(value.period.from, { day: "numeric", month: "short", year: "numeric" }) + " – " + formatDateOnly(value.period.to, { day: "numeric", month: "short", year: "numeric" })
  const fromOptions: Intl.DateTimeFormatOptions = value.period.from.slice(0,4) === value.period.to.slice(0,4) ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }
  return <div className="report-period" data-custom={isCustom}>
    <div className="report-period-main">
      <div className="report-preset"><Label htmlFor="desktopReportPreset">Periodo</Label>
        <Select value={value.preset} items={reportPeriodPresetLabels} onValueChange={preset => handlePresetChange((preset ?? "last30") as ReportPeriodPreset)}>
          <SelectTrigger id="desktopReportPreset"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start">{reportPeriodPresets.map(preset => <SelectItem key={preset} value={preset}>{reportPeriodPresetLabels[preset]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {!isCustom && <div className="report-period-range"><span>Rango seleccionado</span><p aria-label={fullRange}><CalendarDays aria-hidden="true" />{formatDateOnly(value.period.from, fromOptions)} – {formatDateOnly(value.period.to, { day: "numeric", month: "short", year: "numeric" })}</p></div>}
      <ResetFiltersButton disabled={value.preset === "last30"} onReset={clearFilters} />
    </div>
    <div className="report-custom-dates" aria-hidden={!isCustom} inert={!isCustom}><div>
      <div><Label htmlFor="desktopReportFrom">Desde</Label><Input id="desktopReportFrom" type="date" value={value.period.from} max={value.period.to} disabled={!isCustom} aria-invalid={error?.field === "from" || undefined} aria-describedby={error?.field === "from" ? "reportPeriodError" : undefined} onChange={event => handleDateChange("from", event.target.value)} /></div>
      <div><Label htmlFor="desktopReportTo">Hasta</Label><Input id="desktopReportTo" type="date" value={value.period.to} min={value.period.from} disabled={!isCustom} aria-invalid={error?.field === "to" || undefined} aria-describedby={error?.field === "to" ? "reportPeriodError" : undefined} onChange={event => handleDateChange("to", event.target.value)} /></div>
    </div></div>
    {error && <p id="reportPeriodError" role="alert" className="report-period-error">{error.message}. Los reportes siguen mostrando el último periodo válido.</p>}
  </div>
}
