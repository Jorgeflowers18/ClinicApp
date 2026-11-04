import { formatDateOnly, formatDateTime } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"

import { compareEncounters } from "./record"
import {
  attachmentKindLabels,
  dataConsentSignerLabels,
  dataConsentStatusLabels,
  type ChartSnapshot,
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

const paragraph = (label: string, value: string) => `<h2>${escapeHtml(label)}</h2><p>${escapeHtml(value || "Sin registro")}</p>`

/** Imagen y resumen del odontograma. Solo se acepta un PNG en base64 (sin comillas ni `<`), así el `src` no necesita escape. */
function chartSectionsHtml(chart: ChartSnapshot | null, image: string | null | undefined, alt: string) {
  const summary = chart?.summary
  if (!summary) return paragraph("Odontograma", "Sin odontograma registrado.")
  const chartImage =
    image && PNG_DATA_URL.test(image)
      ? `<figure class="chart"><img src="${image}" alt="${escapeHtml(alt)}"></figure>`
      : `<p class="meta">Imagen del odontograma no disponible.</p>`
  return (
    `<section class="chart-section"><h2>Odontograma</h2>${chartImage}<p>${escapeHtml(summary.overview)}</p></section>` +
    summary.sections
      .filter((section) => section.items.length)
      .map((section) => paragraph(section.heading, section.items.join("\n")))
      .join("") +
    paragraph("Periodontograma", summary.periodontalText)
  )
}

function documentShell(title: string, body: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>body{font-family:Arial,sans-serif;color:#171717;background:#fff;margin:40px;line-height:1.5;font-size:12px}h1{font-size:22px}h2{font-size:15px;border-bottom:1px solid #ccc;margin-top:22px}p{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 6px;text-align:left}.meta{color:#555}.chart-section{break-inside:avoid;page-break-inside:avoid}figure.chart{margin:8px 0 12px}figure.chart img{display:block;width:100%;height:auto;border:1px solid #ddd}.note{border-left:3px solid #999;padding-left:8px;margin:8px 0}</style>
  </head><body>${body}</body></html>`
}

/**
 * Documento HTML autocontenido de la historia: estado actual (odontograma, tratamientos propuestos,
 * consentimiento de datos y archivos) más el listado de atenciones. Todo dato ingresado por el usuario se escapa.
 */
/** Tratamientos realizados en una atención, en una línea: "Resina compuesta (46), Limpieza dental". */
function performedSummary(encounter: ClinicalEncounter, context: RecordDocumentContext) {
  if (!encounter.performedTreatments.length) return "—"
  return encounter.performedTreatments
    .map((item) => {
      const name = context.treatmentName(item.treatmentId, item.description)
      return item.tooth ? `${name} (${item.tooth})` : name
    })
    .join(", ")
}

export function recordDocument(history: PatientClinicalHistory, context: RecordDocumentContext, assets: RecordDocumentAssets = {}) {
  const { record } = history
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
        `<tr><td>${escapeHtml(formatDate(encounter.date))}</td><td>${escapeHtml(context.professionalName(encounter))}</td><td>${escapeHtml(encounter.reason)}</td><td>${escapeHtml(encounter.diagnosis)}</td><td>${escapeHtml(performedSummary(encounter, context))}</td></tr>`
    )
    .join("")

  return documentShell(
    `Historia clínica · ${context.patientName}`,
    `<h1>Historia clínica odontológica</h1><p><strong>${escapeHtml(context.patientName)}</strong> · Documento ${escapeHtml(context.documentId)}</p>
  <p class="meta">Estado al ${escapeHtml(formatDate(record.updatedAt.slice(0, 10)))}</p>
  ${chartSectionsHtml(record.chart, assets.odontogramImage, "Odontograma actual")}
  <h2>Tratamientos propuestos</h2>${plan ? `<table><thead><tr><th>Pieza / zona</th><th>Tratamiento</th></tr></thead><tbody>${plan}</tbody></table>` : "<p>Sin tratamientos propuestos.</p>"}
  ${paragraph("Consentimiento de datos", consentDetail)}
  <h2>Archivos asociados</h2>${record.attachments.length ? `<ul>${record.attachments.map((file) => `<li>${escapeHtml(attachmentKindLabels[file.kind])}: ${escapeHtml(file.name)}</li>`).join("")}</ul>` : "<p>Sin archivos.</p>"}
  <h2>Atenciones</h2>${encounters ? `<table><thead><tr><th>Fecha</th><th>Profesional</th><th>Motivo</th><th>Diagnóstico</th><th>Tratamientos realizados</th></tr></thead><tbody>${encounters}</tbody></table>` : "<p>Sin atenciones registradas.</p>"}
  <p class="meta">Los archivos originales se descargan desde la historia clínica. Este documento solo los enumera.</p>`
  )
}

/**
 * Documento HTML de una atención: datos clínicos, tratamientos realizados, notas aclaratorias y la
 * copia del odontograma de ese momento. Todo dato ingresado por el usuario se escapa.
 */
export function encounterDocument(encounter: ClinicalEncounter, context: RecordDocumentContext, assets: RecordDocumentAssets = {}) {
  const treatments = encounter.performedTreatments
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.tooth || "General")}</td><td>${escapeHtml(context.treatmentName(item.treatmentId, item.description))}</td><td>${escapeHtml(formatCurrency(item.cost))}</td></tr>`
    )
    .join("")
  const total = encounter.performedTreatments.reduce((sum, item) => sum + item.cost, 0)
  const notes = encounter.addenda
    .map(
      (note) =>
        `<div class="note"><p class="meta">${escapeHtml(formatDateTime(note.createdAt))} · ${escapeHtml(note.authorName)}</p><p>${escapeHtml(note.text)}</p></div>`
    )
    .join("")

  return documentShell(
    `Atención del ${formatDate(encounter.date)} · ${context.patientName}`,
    `<h1>Atención odontológica</h1><p><strong>${escapeHtml(context.patientName)}</strong> · Documento ${escapeHtml(context.documentId)}</p>
  <p class="meta">Fecha: ${escapeHtml(formatDate(encounter.date))} · Profesional: ${escapeHtml(context.professionalName(encounter))} · Registrada el ${escapeHtml(formatDateTime(encounter.createdAt))}</p>
  ${paragraph("Motivo de consulta", encounter.reason)}${paragraph("Diagnóstico", encounter.diagnosis)}${paragraph("Procedimientos realizados", encounter.procedures)}${paragraph("Evolución / indicaciones", encounter.evolution)}${paragraph("Observaciones", encounter.notes)}${paragraph("Próximo control", encounter.nextVisit ? formatDate(encounter.nextVisit) : "")}
  <h2>Tratamientos realizados</h2>${treatments ? `<table><thead><tr><th>Pieza / zona</th><th>Tratamiento</th><th>Costo</th></tr></thead><tbody>${treatments}</tbody></table><p>Total: ${escapeHtml(formatCurrency(total))}</p>` : "<p>Sin tratamientos registrados.</p>"}
  ${chartSectionsHtml(encounter.chartSnapshot, assets.odontogramImage, "Odontograma de la atención")}
  <h2>Notas aclaratorias</h2>${notes || "<p>Sin notas aclaratorias.</p>"}
  <p class="meta">La atención es un registro inmutable; las correcciones constan como notas aclaratorias.</p>`
  )
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
