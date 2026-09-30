import { formatDateOnly } from "@/shared/lib/date"

import {
  attachmentKindLabels,
  consentStatusLabels,
  planItemStatusLabels,
  type DentalRecord,
  type DentalVisit,
} from "../types/clinical-history.types"

export interface VisitDocumentContext {
  patientName: string
  documentId: string
  professionalName: string
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export function exportRecord(record: DentalRecord, patientName: string) {
  const json = JSON.stringify(
    { exportedAt: new Date().toISOString(), patientName, patientId: record.patientId, visits: record.visits },
    null,
    2
  )
  downloadBlob(new Blob([json], { type: "application/json" }), `historia-clinica-${record.patientId}.json`)
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)

const formatDate = (value: string) => (value ? formatDateOnly(value, { day: "2-digit", month: "long", year: "numeric" }) : "Sin registro")

/** Recursos generados aparte del registro, que se incrustan en el documento. */
export interface VisitDocumentAssets {
  /** PNG (data URL) del odontograma, generado por el exportador de la librería. */
  odontogramImage?: string | null
}

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/

/** Documento HTML autocontenido de una visita. Todo dato ingresado por el usuario se escapa. */
export function visitDocument(visit: DentalVisit, context: VisitDocumentContext, assets: VisitDocumentAssets = {}) {
  const paragraph = (label: string, value: string) =>
    `<h2>${escapeHtml(label)}</h2><p>${escapeHtml(value || "Sin registro")}</p>`
  const summary = visit.chart?.summary
  const plan = visit.plan
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.tooth || "General")}</td><td>${escapeHtml(item.description)}</td><td>${item.sessions}</td><td>${escapeHtml(planItemStatusLabels[item.status])}</td></tr>`
    )
    .join("")
  const consents = visit.consents
    .map(
      (consent) =>
        `<section><h3>${escapeHtml(consent.procedure)}</h3><p>${escapeHtml(consent.information)}</p><p>Estado: ${escapeHtml(consentStatusLabels[consent.status])} · Firmante: ${escapeHtml(consent.signer || "—")} · Fecha: ${escapeHtml(consent.date ? formatDate(consent.date) : "—")}</p></section>`
    )
    .join("")
  // Solo se acepta un PNG en base64 (sin comillas ni `<`), así el atributo `src` no necesita escape.
  const image = assets.odontogramImage && PNG_DATA_URL.test(assets.odontogramImage) ? assets.odontogramImage : null
  const chartImage = image
    ? `<figure class="chart"><img src="${image}" alt="Odontograma de la visita"></figure>`
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
  <p class="meta">Visita: ${escapeHtml(formatDate(visit.date))} · Profesional: ${escapeHtml(context.professionalName)} · ${visit.status === "cerrada" ? "Visita cerrada" : "Borrador"}</p>
  ${paragraph("Motivo de consulta", visit.reason)}${paragraph("Diagnóstico", visit.diagnosis)}${paragraph("Procedimientos realizados", visit.procedures)}${paragraph("Evolución", visit.evolution)}${paragraph("Notas profesionales", visit.notes)}${paragraph("Próximo control", visit.nextVisit ? formatDate(visit.nextVisit) : "")}
  <h2>Plan de tratamiento</h2>${plan ? `<table><thead><tr><th>Pieza / zona</th><th>Tratamiento</th><th>Sesiones</th><th>Estado</th></tr></thead><tbody>${plan}</tbody></table>` : "<p>Sin tratamientos en el plan.</p>"}
  ${chartSections}
  <h2>Consentimientos</h2>${consents || "<p>Sin consentimientos registrados.</p>"}
  <h2>Archivos asociados</h2>${visit.attachments.length ? `<ul>${visit.attachments.map((file) => `<li>${escapeHtml(attachmentKindLabels[file.kind])}: ${escapeHtml(file.name)}</li>`).join("")}</ul>` : "<p>Sin archivos.</p>"}
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
export async function printVisit(report: Window, html: string) {
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
