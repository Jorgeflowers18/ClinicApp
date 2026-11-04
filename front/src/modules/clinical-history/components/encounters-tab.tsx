import { useEffect, useRef } from "react"
import { Lock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateOnly } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import { cn } from "@/lib/utils"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { compareEncounters, resolveProfessionalName } from "../lib/record"
import type { ClinicalEncounter } from "../types/clinical-history.types"

const longDate = (value: string) => formatDateOnly(value, { day: "2-digit", month: "long", year: "numeric" })

interface EncountersTabProps {
  encounters: ClinicalEncounter[]
  /** Atención abierta desde la URL (`?atencion=`), que se resalta y se lleva a la vista. */
  highlightedId: string | null
}

/** Historial de atenciones del paciente, de la más reciente a la más antigua. Solo lectura. */
export function EncountersTab({ encounters, highlightedId }: EncountersTabProps) {
  const { data: professionals } = useProfessionals()
  const highlighted = useRef<HTMLElement>(null)
  const sorted = [...encounters].sort(compareEncounters).reverse()

  useEffect(() => {
    highlighted.current?.scrollIntoView({ block: "center" })
  }, [highlightedId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atenciones</CardTitle>
        <CardDescription>
          Cada atención registrada queda como constancia y no se puede modificar. Conserva una copia del odontograma
          de ese momento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aún no hay atenciones registradas.
          </div>
        )}
        {sorted.map((encounter) => {
          const isHighlighted = encounter.id === highlightedId
          const total = encounter.performedTreatments.reduce((sum, item) => sum + item.cost, 0)
          const details = [
            { label: "Diagnóstico", value: encounter.diagnosis },
            { label: "Procedimientos", value: encounter.procedures },
            { label: "Evolución / indicaciones", value: encounter.evolution },
            { label: "Observaciones", value: encounter.notes },
          ].filter((item) => item.value.trim())
          return (
            <article
              key={encounter.id}
              ref={isHighlighted ? highlighted : undefined}
              aria-current={isHighlighted ? "true" : undefined}
              className={cn("space-y-2 rounded-lg border p-4", isHighlighted && "border-primary ring-2 ring-primary/30")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">
                    {longDate(encounter.date)} · {encounter.reason || "Sin motivo registrado"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {resolveProfessionalName(encounter, professionals)}
                    {encounter.appointmentId && " · Con cita vinculada"}
                  </p>
                </div>
                <Badge variant="outline">
                  <Lock />
                  Registrada
                </Badge>
              </div>
              {details.map((item) => (
                <p key={item.label} className="whitespace-pre-wrap text-sm">
                  <strong>{item.label}: </strong>
                  {item.value}
                </p>
              ))}
              {encounter.performedTreatments.length > 0 && (
                <div className="text-sm">
                  <strong>Tratamientos realizados: </strong>
                  {encounter.performedTreatments
                    .map((item) => `${item.description}${item.tooth ? ` (${item.tooth})` : ""} · ${formatCurrency(item.cost)}`)
                    .join(" — ")}
                  <span className="text-muted-foreground"> · Total {formatCurrency(total)}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Próximo control: {encounter.nextVisit ? longDate(encounter.nextVisit) : "Por definir"}
              </p>
            </article>
          )
        })}
      </CardContent>
    </Card>
  )
}
