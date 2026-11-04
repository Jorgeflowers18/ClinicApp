import { useEffect, useRef, useState } from "react"
import { Lock, MessageSquarePlus, Printer, Smile } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateOnly, formatDateTime } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { formatCurrency } from "@/shared/lib/number"
import { cn } from "@/lib/utils"

import { encounterDocument, openPrintWindow, printDocument, type RecordDocumentContext } from "../lib/dental-export"
import { compareEncounters } from "../lib/record"
import type { ClinicalEncounter } from "../types/clinical-history.types"
import { EncounterChartDialog, EncounterPrinter } from "./encounter-chart"
import { EncounterNoteDialog } from "./encounter-note-dialog"

const longDate = (value: string) => formatDateOnly(value, { day: "2-digit", month: "long", year: "numeric" })

interface EncountersTabProps {
  patientId: string
  patientName: string
  birthDate: string
  encounters: ClinicalEncounter[]
  /** Atención abierta desde la URL (`?atencion=`), que se resalta y se lleva a la vista. */
  highlightedId: string | null
  documentContext: RecordDocumentContext
}

/** Historial de atenciones del paciente, de la más reciente a la más antigua. Solo lectura más notas aclaratorias. */
export function EncountersTab({ patientId, patientName, birthDate, encounters, highlightedId, documentContext }: EncountersTabProps) {
  const highlighted = useRef<HTMLElement>(null)
  const [viewing, setViewing] = useState<ClinicalEncounter | null>(null)
  const [noteFor, setNoteFor] = useState<ClinicalEncounter | null>(null)
  const [printing, setPrinting] = useState<{ encounter: ClinicalEncounter; report: Window } | null>(null)
  const sorted = [...encounters].sort(compareEncounters).reverse()

  useEffect(() => {
    highlighted.current?.scrollIntoView({ block: "center" })
  }, [highlightedId])

  function print(encounter: ClinicalEncounter) {
    let report: Window
    try {
      // Se abre dentro del clic para que el navegador no la bloquee.
      report = openPrintWindow()
    } catch (error) {
      toast.error(getErrorMessage(error))
      return
    }
    if (encounter.chartSnapshot) {
      setPrinting({ encounter, report })
      return
    }
    printDocument(report, encounterDocument(encounter, documentContext)).catch((error) => {
      report.close()
      toast.error(getErrorMessage(error))
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atenciones</CardTitle>
        <CardDescription>
          Cada atención registrada queda como constancia y no se puede modificar. Conserva una copia del odontograma
          de ese momento; las correcciones se agregan como notas aclaratorias.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aún no hay atenciones registradas. Usa «Registrar atención» para agregar la primera.
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
              aria-label={`Atención del ${longDate(encounter.date)}`}
              className={cn("space-y-2 rounded-lg border p-4", isHighlighted && "border-primary ring-2 ring-primary/30")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">
                    {longDate(encounter.date)} · {encounter.reason || "Sin motivo registrado"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {documentContext.professionalName(encounter)}
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

              {encounter.addenda.length > 0 && (
                <section aria-label="Notas aclaratorias" className="space-y-2 border-t pt-2">
                  {encounter.addenda.map((note) => (
                    <div key={note.id} className="rounded-md border-l-2 border-muted-foreground/40 bg-muted/40 px-3 py-2 text-sm">
                      <p className="text-xs text-muted-foreground">
                        Nota aclaratoria · {formatDateTime(note.createdAt, { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                        {note.authorName}
                      </p>
                      <p className="whitespace-pre-wrap">{note.text}</p>
                    </div>
                  ))}
                </section>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {encounter.chartSnapshot && (
                  <Button size="sm" variant="outline" onClick={() => setViewing(encounter)}>
                    <Smile />
                    Ver odontograma
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={printing?.encounter.id === encounter.id}
                  onClick={() => print(encounter)}
                >
                  <Printer />
                  {printing?.encounter.id === encounter.id ? "Preparando documento..." : "Imprimir / Guardar PDF"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNoteFor(encounter)}>
                  <MessageSquarePlus />
                  Agregar nota aclaratoria
                </Button>
              </div>
            </article>
          )
        })}
      </CardContent>

      <EncounterChartDialog
        encounter={viewing}
        onClose={() => setViewing(null)}
        patientName={patientName}
        birthDate={birthDate}
      />
      <EncounterNoteDialog patientId={patientId} encounter={noteFor} onClose={() => setNoteFor(null)} />
      {printing && (
        <EncounterPrinter
          key={printing.encounter.id}
          encounter={printing.encounter}
          report={printing.report}
          context={documentContext}
          patientName={patientName}
          birthDate={birthDate}
          onDone={() => setPrinting(null)}
        />
      )}
    </Card>
  )
}
