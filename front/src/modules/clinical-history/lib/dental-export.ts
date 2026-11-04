import { formatDateOnly } from "@/shared/lib/date"

import { compareEncounters } from "./record"
import {
  attachmentKindLabels,
  dataConsentSignerLabels,
  dataConsentStatusLabels,
  type ClinicalEncounter,
  type PatientClinicalHistory,
} from "../types/clinical-history.types"

export interface RecordDocumentContext {
  patientName: string
  documentId: string
  professionalName: (encounter: ClinicalEncounter) => string
  /** Nombre del tratamiento en el catálogo (o el texto guardado si ya no existe). */
  treatmentName: (treatmentId: string | null, fallback: string) => string
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export function exportHistory(history: PatientClinicalHistory, patientName: string) {
  const json = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      patientName,
      patientId: history.record.patientId,
      record: history.record,
      encounters: history.encounters,
    },
    null,
    2
  )
  downloadBlob(new Blob([json], { type: "application/json" }), `historia-clinica-${history.record.patientId}.json`)
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)

const formatDate = (value: string) => (value ? formatDateOnly(value, { day: "2-digit", month: "long", year: "numeric" }) : "Sin registro")

/** Recursos generados aparte del registro, que se incrustan en el documento. */
export interface RecordDocumentAssets {
  /** PNG (data URL) del odontograma, generado por el exportador de la librería. */
  odontogramImage?: string | null
}

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/

/**
 * Documento HTML autocontenido de la historia: estado actual (odontograma, tratamientos propuestos,
 * consentimiento de datos y archivos) más el listado de atenciones. Todo dato ingresado por el usuario se escapa.
 */
export function recordDocument(history: PatientClinicalHistory, context: RecordDocumentContext, assets: RecordDocumentAssets = {}) {
  const { record } = history
  const paragraph = (label: string, value: string) =>
    `<h2>${escapeHtml(label)}</h2><p>${escapeHtml(value || "Sin registro")}</p>`
  const summary = record.chart?.summary
  const plan = record.plan
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.tooth || "General")}</td><td>${escapeHtml(context.treatmentName(item.treatmentId, item.description))}</td></tr>`
    )
    .join("")
  const consent = record.dataConsent
  const consentDetail =
    consent.status === "pendiente"
      ? "Pendiente de registrar."
      : `${dataConsentStatusLabels[consent.status]} por ${dataConsentSignerLabels[consent.signer].toLowerCase()}: ${consent.signerName} (cédula ${consent.signerDocumentId}) el ${formatDate(consent.date)}.`
  const encounters = [...history.encounters]
    .sort(compareEncounters)
    .reverse()
    .map(
      (encounter) =>
        `<tr><td>${escapeHtml(formatDate(encounter.date))}</td><td>${escapeHtml(context.professionalName(encounter))}</td><td>${escapeHtml(encounter.reason)}</td><td>${escapeHtml(encounter.diagnosis)}</td></tr>`
    )
    .join("")
  // Solo se acepta un PNG en base64 (sin comillas ni `<`), así el atributo `src` no necesita escape.
  const image = assets.odontogramImage && PNG_DATA_URL.test(assets.odontogramImage) ? assets.odontogramImage : null
  const chartImage = image
    ? `<figure class="chart"><img src="${image}" alt="Odontograma actual"></figure>`
    : summary
      ? `<p class="meta">Imagen del odontograma no disponible.</p>`
      : ""
  const chartSections = summary
    ? `<section class="chart-section"><h2>Odontograma</h2>${chartImage}<p>${escapeHtml(summary.overview)}</p></section>` +
      summary.sections
        .filter((section) => section.items.length)
        .map((section) => paragraph(section.heading, section.items.join("\n")))
        .join("") +
      paragraph("Periodontograma", summary.periodontalText)
    : paragraph("Odontograma", "Sin odontograma registrado.")

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Historia clínica · ${escapeHtml(context.patientName)}</title>
  <style>body{font-family:Arial,sans-serif;color:#171717;background:#fff;margin:40px;line-height:1.5;font-size:12px}h1{font-size:22px}h2{font-size:15px;border-bottom:1px solid #ccc;margin-top:22px}p{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 6px;text-align:left}.meta{color:#555}.chart-section{break-inside:avoid;page-break-inside:avoid}figure.chart{margin:8px 0 12px}figure.chart img{display:block;width:100%;height:auto;border:1px solid #ddd}</style>
  </head><body><h1>Historia clínica odontológica</h1><p><strong>${escapeHtml(context.patientName)}</strong> · Documento ${escapeHtml(context.documentId)}</p>
  <p class="meta">Estado al ${escapeHtml(formatDate(record.updatedAt.slice(0, 10)))}</p>
  ${chartSections}
  <h2>Tratamientos propuestos</h2>${plan ? `<table><thead><tr><th>Pieza / zona</th><th>Tratamiento</th></tr></thead><tbody>${plan}</tbody></table>` : "<p>Sin tratamientos propuestos.</p>"}
  ${paragraph("Consentimiento de datos", consentDetail)}
  <h2>Archivos asociados</h2>${record.attachments.length ? `<ul>${record.attachments.map((file) => `<li>${escapeHtml(attachmentKindLabels[file.kind])}: ${escapeHtml(file.name)}</li>`).join("")}</ul>` : "<p>Sin archivos.</p>"}
  <h2>Atenciones</h2>${encounters ? `<table><thead><tr><th>Fecha</th><th>Profesional</th><th>Motivo</th><th>Diagnóstico</th></tr></thead><tbody>${encounters}</tbody></table>` : "<p>Sin atenciones registradas.</p>"}
  <p class="meta">Los archivos originales se descargan desde la historia clínica. Este documento solo los enumera.</p></body></html>`
}

/**
 * Abre la ventana de impresión dentro del mismo clic del usuario (si se abre después de una espera
 * asíncrona, el navegador la bloquea como ventana emergente). Muestra un aviso mientras se prepara.
 */
export function openPrintWindow() {
  const report = window.open("", "_blank")
  if (!report) throw new Error("Permite abrir ventanas emergentes para imprimir o guardar el documento en PDF.")
  report.opener = null
  report.document.write('<!doctype html><html lang="es"><title>Preparando documento…</title><p style="font-family:Arial,sans-serif">Preparando documento…</p></html>')
  return report
}

/** Escribe el documento en la ventana abierta con `openPrintWindow` e imprime cuando cargan sus imágenes. */
export async function printDocument(report: Window, html: string) {
  report.document.open()
  report.document.write(html)
  report.document.close()
  await Promise.all(
    Array.from(report.document.images).map((image) =>
      image.complete ? undefined : new Promise((resolve) => {
        image.onload = image.onerror = () => resolve(undefined)
      })
    )
  )
  report.focus()
  report.print()
}
