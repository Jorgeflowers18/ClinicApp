import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { getPresetPeriod } from "../lib/period"
import {
  reportPeriodPresetLabels,
  reportPeriodPresets,
  type ReportPeriodPreset,
  type ReportPeriodState,
} from "../types/report.types"

interface PeriodSelectorProps {
  value: ReportPeriodState
  onChange: (next: ReportPeriodState) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const isCustom = value.preset === "custom"

  function handlePresetChange(preset: ReportPeriodPreset) {
    onChange({ preset, period: preset === "custom" ? value.period : getPresetPeriod(preset) })
  }

  function handleDateChange(field: "from" | "to", date: string) {
    if (!date) return
    onChange({ preset: "custom", period: { ...value.period, [field]: date } })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="reportPreset">Periodo</Label>
        <Select
          value={value.preset}
          onValueChange={(preset) => handlePresetChange((preset ?? "last30") as ReportPeriodPreset)}
        >
          <SelectTrigger id="reportPreset" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reportPeriodPresets.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {reportPeriodPresetLabels[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="reportFrom">Desde</Label>
        <Input
          id="reportFrom"
          type="date"
          value={value.period.from}
          max={value.period.to}
          disabled={!isCustom}
          onChange={(event) => handleDateChange("from", event.target.value)}
          className="w-auto"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="reportTo">Hasta</Label>
        <Input
          id="reportTo"
          type="date"
          value={value.period.to}
          min={value.period.from}
          disabled={!isCustom}
          onChange={(event) => handleDateChange("to", event.target.value)}
          className="w-auto"
        />
      </div>
    </div>
  )
}
