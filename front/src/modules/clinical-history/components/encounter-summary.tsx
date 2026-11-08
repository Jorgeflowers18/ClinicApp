import { cn } from "@/lib/utils"

import type { SummarySection } from "../lib/encounter-summary"

interface EncounterSummaryProps {
  sections: SummarySection[]
  /** Botón por sección (por ejemplo, «Editar» en la revisión). */
  action?: (section: SummarySection) => React.ReactNode
  className?: string
}

/** Secciones con datos de una atención, agrupadas como los pasos de «Registrar atención». */
export function EncounterSummary({ sections, action, className }: EncounterSummaryProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {sections.map((section) => (
        <section key={section.step} aria-label={section.title} className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{section.title}</h4>
            {action?.(section)}
          </div>
          <dl className="space-y-1 text-sm">
            {section.items.map((item) => (
              <div key={item.label} className="grid gap-x-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
                <dt className="font-medium">{item.label}</dt>
                <dd className="whitespace-pre-wrap">
                  {Array.isArray(item.value) ? (
                    <ul className="space-y-0.5">
                      {item.value.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    item.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
