import { attachmentLabels, treatmentLabels, type DentalRecord, type DentalVisit } from "./types"

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export function exportRecord(record: DentalRecord, patientName: string) {
  const json = JSON.stringify({ exportedAt: new Date().toISOString(), patientName, ...record }, null, 2)
  downloadBlob(new Blob([json], { type: "application/json" }), `historia-odontologica-${record.patientId}.json`)
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)

export function visitDocument(visit: DentalVisit, patientName: string, documentId: string) {
  const paragraph = (label: string, value: string) => `<h2>${escapeHtml(label)}</h2><p>${escapeHtml(value || "Sin registro")}</p>`
  const summary = visit.chart?.summary
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Historia odontológica · ${escapeHtml(patientName)}</title>
  <style>body{font-family:Arial,sans-serif;color:#171717;background:#fff;margin:40px;line-height:1.5;font-size:12px}h1{font-size:22px}h2{font-size:15px;border-bottom:1px solid #ccc;margin-top:22px}p{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{padding:8px;text-align:left;border:1px solid #ddd}section{break-inside:avoid}.meta{color:#555}@media print{body{margin:0}@page{margin:18mm}}</style>
  </head><body><h1>Historia clínica odontológica</h1><p><strong>${escapeHtml(patientName)}</strong> · Documento ${escapeHtml(documentId)}</p>
  <p class="meta">Visita: ${escapeHtml(visit.date)} · Profesional: ${escapeHtml(visit.professional)} · ${visit.savedAt ? "Registro guardado" : "Borrador"}</p>
  ${paragraph("Motivo de consulta", visit.reason)}${paragraph("Diagnóstico", visit.diagnosis)}${paragraph("Procedimientos realizados", visit.procedures)}${paragraph("Evolución por visita", visit.evolution)}${paragraph("Notas profesionales", visit.notes)}${paragraph("Próximo control", visit.nextVisit)}
  <h2>Plan de tratamiento</h2><table><thead><tr><th>Pieza / zona</th><th>Procedimiento</th><th>Estado</th></tr></thead><tbody>${visit.plan.map((item) => `<tr><td>${escapeHtml(item.tooth || "General")}</td><td>${escapeHtml(item.description)}</td><td>${treatmentLabels[item.status]}</td></tr>`).join("")}</tbody></table>
  ${summary ? paragraph("Odontograma", summary.overview) + summary.sections.filter((section) => section.items.length).map((section) => paragraph(section.heading, section.items.join("\n"))).join("") + paragraph("Periodontograma", summary.periodontalText) + (summary.individualNotes ? paragraph("Notas por pieza", summary.individualNotes.items.join("\n")) : "") : ""}
  <h2>Consentimientos</h2>${visit.consents.map((consent) => `<section><h3>${escapeHtml(consent.procedure)}</h3><p>${escapeHtml(consent.information)}</p><p>Estado: ${escapeHtml(consent.status)} · Firmante: ${escapeHtml(consent.signer || "—")} · Fecha: ${escapeHtml(consent.date || "—")}</p></section>`).join("") || "<p>Sin consentimientos registrados.</p>"}
  <h2>Archivos asociados</h2><ul>${visit.attachments.map((file) => `<li>${attachmentLabels[file.kind]}: ${escapeHtml(file.name)}</li>`).join("")}</ul>
  <p class="meta">Los archivos originales se descargan desde la historia clínica. Este documento enumera los adjuntos.</p></body></html>`
}

export function printVisit(visit: DentalVisit, patientName: string, documentId: string) {
  const report = window.open("", "_blank")
  if (!report) throw new Error("Permite abrir ventanas para imprimir o guardar el documento en PDF.")
  report.opener = null
  report.document.write(visitDocument(visit, patientName, documentId))
  report.document.close()
  report.focus()
  report.print()
}
