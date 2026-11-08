import { TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

import { medicalAlertsOf } from "../lib/record"
import type { Allergy, MedicalAlertKey } from "../types/background.types"

interface MedicalAlertsProps {
  /** Alertas marcadas y alergias registradas (de la historia guardada o de la copia de una atención). */
  source: { alerts: readonly MedicalAlertKey[]; allergies: readonly Allergy[] }
  title?: string
  className?: string
}

/** Franja de alertas médicas y alergias. No se muestra si no hay ninguna. */
export function MedicalAlerts({ source, title = "Alertas médicas", className }: MedicalAlertsProps) {
  const items = medicalAlertsOf(source)
  if (!items.length) return null
  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm",
        className
      )}
    >
      <span className="flex items-center gap-1.5 font-medium text-destructive">
        <TriangleAlert className="size-4" />
        {title}
      </span>
      <span>{items.join(" · ")}</span>
    </section>
  )
}
