import { useState } from "react"
import { Download, FileText, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { env } from "@/shared/lib/env"
import { getErrorMessage } from "@/shared/lib/error-message"

import {
  downloadBlob,
  exportHistory,
  openPrintWindow,
  printDocument,
  recordDocument,
  type RecordDocumentContext,
} from "../lib/dental-export"
import type { PatientClinicalHistory } from "../types/clinical-history.types"

interface ExportCardProps {
  context: RecordDocumentContext
  /** Devuelve la historia tal como está en pantalla (con el odontograma más reciente, guardado o no). */
  getCurrentHistory: () => PatientClinicalHistory
  /** Genera el PNG del odontograma con el exportador de la librería; `null` si no se pudo. */
  captureOdontogramImage: () => Promise<string | null>
  disabled: boolean
}

export function ExportCard({ context, getCurrentHistory, captureOdontogramImage, disabled }: ExportCardProps) {
  const [preparing, setPreparing] = useState(false)

  /** Arma el documento de la historia con la imagen del odontograma incrustada. */
  async function buildDocument() {
    const history = getCurrentHistory()
    const odontogramImage = await captureOdontogramImage()
    if (!odontogramImage) {
      toast.warning("No se pudo generar la imagen del odontograma; el documento se exporta sin ella.")
    }
    return recordDocument(history, context, { odontogramImage })
  }

  async function print() {
    let report: Window
    try {
      // Se abre antes de cualquier espera para que el navegador no la bloquee.
      report = openPrintWindow()
    } catch (error) {
      toast.error(getErrorMessage(error))
      return
    }
    setPreparing(true)
    try {
      await printDocument(report, await buildDocument())
    } catch (error) {
      report.close()
      toast.error(getErrorMessage(error))
    } finally {
      setPreparing(false)
    }
  }

  async function downloadDocument() {
    setPreparing(true)
    try {
      const html = await buildDocument()
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `historia-clinica-${getCurrentHistory().record.patientId}.html`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setPreparing(false)
    }
  }

  function downloadHistory() {
    try {
      exportHistory(getCurrentHistory(), context.patientName)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const busy = disabled || preparing

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="size-4" />
          Exportar documentos clínicos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void print()}>
            <Printer />
            {preparing ? "Preparando documento..." : "Imprimir / Guardar PDF"}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void downloadDocument()}>
            <Download />
            Documento de la historia
          </Button>
          <Button variant="outline" disabled={busy} onClick={downloadHistory}>
            <Download />
            Historia completa JSON
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          El PDF y el documento incluyen la imagen del odontograma tal como se ve en pantalla, los tratamientos
          propuestos, el consentimiento de datos y el listado de atenciones. El menú «Exportar» del editor sigue
          ofreciendo su propio informe PDF, imágenes, SVG y FHIR. Las fotos y los documentos originales se descargan
          desde su ficha.
          {/* MOCK-ONLY */}
          {env.useMockApi &&
            " En modo demostración la historia vive en este navegador: la «Historia completa JSON» sirve de respaldo."}
        </p>
      </CardContent>
    </Card>
  )
}
