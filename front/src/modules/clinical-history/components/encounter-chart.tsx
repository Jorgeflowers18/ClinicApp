import { useEffect, useRef } from "react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"

import { encounterDocument, printDocument, type RecordDocumentContext } from "../lib/dental-export"
import type { ClinicalEncounter } from "../types/clinical-history.types"
import { OdontogramFrame, type ChartHandle } from "./odontogram-frame"

const FRAME_TIMEOUT_MS = 30000

interface PatientData {
  patientName: string
  birthDate: string
}

/** Copia del odontograma de una atención, en solo lectura. */
export function EncounterChartDialog({
  encounter,
  onClose,
  patientName,
  birthDate,
}: PatientData & { encounter: ClinicalEncounter | null; onClose: () => void }) {
  const handle = useRef<ChartHandle | null>(null)
  return (
    <Dialog open={Boolean(encounter)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            Odontograma de la atención
            {encounter && ` del ${formatDateOnly(encounter.date, { day: "2-digit", month: "long", year: "numeric" })}`}
          </DialogTitle>
          <DialogDescription>
            Copia guardada al registrar la atención. No cambia aunque después se modifique la historia.
          </DialogDescription>
        </DialogHeader>
        {encounter && (
          <OdontogramFrame
            source={{ chart: encounter.chartSnapshot, date: encounter.date }}
            patientName={patientName}
            birthDate={birthDate}
            readOnly
            handle={handle}
            onReady={() => undefined}
            onChange={() => undefined}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Imprime el documento de una atención con la imagen de su copia del odontograma. Monta un editor
 * oculto (con su tamaño real, para que la librería pueda dibujar la imagen), lo captura y escribe el
 * documento en la ventana que se abrió en el clic del usuario.
 */
export function EncounterPrinter({
  encounter,
  report,
  context,
  patientName,
  birthDate,
  onDone,
}: PatientData & {
  encounter: ClinicalEncounter
  report: Window
  context: RecordDocumentContext
  onDone: () => void
}) {
  const handle = useRef<ChartHandle | null>(null)
  const started = useRef(false)
  const job = useRef({ encounter, report, context, onDone })

  async function run(withImage: boolean) {
    if (started.current) return
    started.current = true
    const { encounter: current, report: target, context: documentContext, onDone: done } = job.current
    const image = withImage ? ((await handle.current?.captureImage()) ?? null) : null
    if (!image) toast.warning("No se pudo generar la imagen del odontograma; el documento se imprime sin ella.")
    try {
      await printDocument(target, encounterDocument(current, documentContext, { odontogramImage: image }))
    } catch (error) {
      target.close()
      toast.error(getErrorMessage(error))
    }
    done()
  }

  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })
  // Si el editor no llega a cargar, el documento sale igual, sin la imagen.
  useEffect(() => {
    const timer = window.setTimeout(() => void runRef.current(false), FRAME_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div aria-hidden inert className="pointer-events-none invisible fixed top-0 left-0 -z-10 w-[1200px]">
      <OdontogramFrame
        source={{ chart: encounter.chartSnapshot, date: encounter.date }}
        patientName={patientName}
        birthDate={birthDate}
        readOnly
        handle={handle}
        onReady={(ready) => ready && void runRef.current(true)}
        onChange={() => undefined}
      />
    </div>
  )
}
