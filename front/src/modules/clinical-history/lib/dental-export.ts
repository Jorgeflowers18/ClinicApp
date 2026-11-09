import { calculateAge, formatDateOnly, formatDateTime } from "@/shared/lib/date"
import { formatCurrency } from "@/shared/lib/number"
import type { Professional } from "@/modules/appointments/types/appointment.types"
import { genderLabels, maritalStatusLabels, type Patient } from "@/modules/patients/types/patient.types"

import { encounterSections } from "./encounter-summary"
import { groupPlanByPhase } from "./plan"
import { compareEncounters, medicalAlertsOf } from "./record"
import {
  bruxismPatternLabels,
  dentalBackgroundLabels,
  hygieneAidLabels,
  hygieneQualityLabels,
  isConditionMarked,
  medicalConditionItems,
  periodontalBackgroundLabels,
  truthDeclarationText,
  yesNoLabels,
  type Habits,
  type YesNo,
} from "../types/background.types"
import { examKindLabels } from "../types/encounter-assessment.types"
import {
  attachmentKindLabels,
  dataConsentSignerLabels,
  dataConsentStatusLabels,
  diagnosisSummary,
  examRequestStatusLabels,
  type ChartSnapshot,
  type ClinicalEncounter,
  type ClinicalRecord,
  type PatientClinicalHistory,
} from "../types/clinical-history.types"

export interface RecordDocumentContext {
  patientName: string
  documentId: string
  /** Paciente guardado: sus datos encabezan el documento de la historia. */
  patient?: Patient
  /** Profesionales, para el profesional tratante y su registro en la declaración de veracidad. */
  professionals?: Professional[]
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

/** Tabla de dos columnas «dato: valor»; omite las filas vacías. */
function definitionTable(rows: [string, string][]) {
  const filled = rows.filter(([, value]) => value.trim())
  if (!filled.length) return "<p>Sin registro.</p>"
  return `<table><tbody>${filled.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody></table>`
}

const list = (items: string[], empty: string) =>
  items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>${escapeHtml(empty)}</p>`

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
  <style>body{font-family:Arial,sans-serif;color:#171717;background:#fff;margin:40px;line-height:1.5;font-size:12px}h1{font-size:22px}h2{font-size:15px;border-bottom:1px solid #ccc;margin-top:22px}h3{font-size:13px;margin:14px 0 4px}p{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}tbody th{width:32%;background:#f6f6f6;font-weight:600}.meta{color:#555}.alerts{border:2px solid #b91c1c;background:#fef2f2;padding:6px 10px;margin:12px 0}.alerts strong{color:#b91c1c}.chart-section{break-inside:avoid;page-break-inside:avoid}figure.chart{margin:8px 0 12px}figure.chart img{display:block;width:100%;height:auto;border:1px solid #ddd}.note{border-left:3px solid #999;padding-left:8px;margin:8px 0}</style>
  </head><body>${body}</body></html>`
}

/** Franja de alertas destacada; vacía si no hay alertas ni alergias. */
function alertsHtml(source: Parameters<typeof medicalAlertsOf>[0], title: string) {
  const items = medicalAlertsOf(source)
  return items.length ? `<div class="alerts"><strong>${escapeHtml(title)}:</strong> ${escapeHtml(items.join(" · "))}</div>` : ""
}

function patientDataHtml(patient: Patient | undefined, record: ClinicalRecord) {
  if (!patient) return ""
  const age = calculateAge(patient.birthDate)
  return `<h2>Datos del paciente</h2>${definitionTable([
    ["N.° de historia clínica", patient.clinicalRecordNumber],
    ["Fecha de apertura", formatDateTime(record.createdAt, { day: "2-digit", month: "long", year: "numeric" })],
    ["Fecha de actualización", formatDateTime(record.updatedAt, { day: "2-digit", month: "long", year: "numeric" })],
    ["Apellidos y nombres", `${patient.lastName} ${patient.firstName}`],
    ["Cédula / pasaporte", patient.documentId],
    ["Fecha de nacimiento", patient.birthDate ? formatDate(patient.birthDate) : ""],
    ["Edad", age !== null ? `${age} años` : ""],
    ["Sexo / género", genderLabels[patient.gender] ?? ""],
    ["Estado civil", maritalStatusLabels[patient.maritalStatus] ?? ""],
    ["Ocupación", patient.occupation],
    ["Empresa / institución", patient.company],
    ["Nacionalidad", patient.nationality],
    ["Dirección domiciliaria", patient.address],
    ["Ciudad / provincia", patient.city],
    ["Teléfono", patient.phone],
    ["Correo electrónico", patient.email],
    [
      "Contacto de emergencia / parentesco",
      [patient.emergencyContactName, patient.emergencyContactRelationship].filter(Boolean).join(" · "),
    ],
    ["Teléfono de emergencia", patient.emergencyContactPhone],
  ])}`
}

const answer = (value: YesNo) => (value ? yesNoLabels[value] : "")

function habitLines(habits: Habits): [string, string][] {
  const { tobacco, alcohol, bruxism, mouthBreathing, hygiene, cariogenicDiet } = habits
  const detail = (value: YesNo, extra: string) => [answer(value), value === "si" ? extra : ""].filter(Boolean).join(" · ")
  return [
    ["Tabaco / vapeo", detail(tobacco.answer, tobacco.detail)],
    ["Alcohol / sustancias", detail(alcohol.answer, alcohol.detail)],
    ["Bruxismo / apretamiento", detail(bruxism.answer, bruxism.pattern ? bruxismPatternLabels[bruxism.pattern] : "")],
    ["Respiración oral", answer(mouthBreathing.answer)],
    [
      "Higiene oral",
      detail(
        hygiene.answer,
        [
          hygiene.quality && hygieneQualityLabels[hygiene.quality],
          hygiene.brushingPerDay !== null && `${hygiene.brushingPerDay} cepillados por día`,
          hygiene.aids.length > 0 && `Usa: ${hygiene.aids.map((aid) => hygieneAidLabels[aid]).join(", ")}`,
        ]
          .filter(Boolean)
          .join(" · ")
      ),
    ],
    ["Dieta cariogénica", detail(cariogenicDiet.answer, cariogenicDiet.detail)],
  ]
}

function backgroundHtml(record: ClinicalRecord) {
  const medical = record.medicalBackground
  const conditions = medicalConditionItems.flatMap(([key, label]) => {
    const condition = medical.conditions[key]
    if (!isConditionMarked(condition)) return []
    const type = [condition.personal && "personal", condition.family && "familiar"].filter(Boolean).join(" y ")
    return [`${label} (${type})${condition.detail.trim() ? `: ${condition.detail.trim()}` : ""}`]
  })
  const { allergies, medications } = record.allergiesAndMedication
  return `<h2>Antecedentes médicos personales y familiares</h2>${
    medical.denies ? "<p>Niega antecedentes relevantes.</p>" : list(conditions, "Sin antecedentes registrados.")
  }
  <h2>Alergias, medicamentos y alertas</h2>
  <h3>Alergias</h3>${
    allergies.length
      ? `<table><thead><tr><th>Alergia / reacción</th><th>Medicamento o sustancia</th><th>Manifestación y gravedad</th></tr></thead><tbody>${allergies
          .map((item) => `<tr><td>${escapeHtml(item.reaction)}</td><td>${escapeHtml(item.substance)}</td><td>${escapeHtml(item.manifestation)}</td></tr>`)
          .join("")}</tbody></table>`
      : "<p>Sin alergias registradas.</p>"
  }
  <h3>Medicación actual</h3>${
    medications.length
      ? `<table><thead><tr><th>Medicamento</th><th>Dosis / frecuencia</th><th>Indicación / médico tratante</th></tr></thead><tbody>${medications
          .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.dose)}</td><td>${escapeHtml(item.indication)}</td></tr>`)
          .join("")}</tbody></table>`
      : "<p>Sin medicación registrada.</p>"
  }
  <h2>Hábitos y factores de riesgo</h2>${definitionTable(habitLines(record.habits))}
  <h2>Antecedentes odontológicos</h2>${list(record.dentalBackground.items.map((key) => dentalBackgroundLabels[key]), "Sin antecedentes registrados.")}${
    record.dentalBackground.notes.trim() ? `<p>${escapeHtml(record.dentalBackground.notes)}</p>` : ""
  }
  <h2>Antecedentes y síntomas periodontales</h2>${list(
    record.periodontalBackground.items.map((key) => periodontalBackgroundLabels[key]),
    "Sin antecedentes registrados."
  )}`
}

function declarationHtml(record: ClinicalRecord, context: RecordDocumentContext) {
  const declaration = record.truthDeclaration
  const professional = context.professionals?.find((item) => item.id === declaration.professionalId)
  return `<h2>Declaración de veracidad del paciente</h2><p>${escapeHtml(truthDeclarationText)}</p>${
    declaration.accepted
      ? definitionTable([
          ["Aceptada por", `${dataConsentSignerLabels[declaration.signer]}: ${declaration.signerName}`],
          ["C.I.", declaration.signerDocumentId],
          ["Fecha", formatDate(declaration.date)],
          ["Profesional tratante", professional?.name ?? ""],
          ["Registro profesional", professional?.registrationNumber ?? ""],
          ["Firmas", "Pendiente de definir"],
        ])
      : "<p>Pendiente de aceptación.</p>"
  }`
}

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

/**
 * Documento HTML autocontenido de la historia: datos del paciente, alertas (destacadas al inicio),
 * antecedentes, odontograma, plan por fases, consentimiento, declaración, exámenes solicitados,
 * archivos y el listado de atenciones. Todo dato ingresado por el usuario se escapa.
 */
export function recordDocument(history: PatientClinicalHistory, context: RecordDocumentContext, assets: RecordDocumentAssets = {}) {
  const { record } = history
  const plan = groupPlanByPhase(record.plan)
    .map(
      (group) =>
        `<tr><th colspan="3">${escapeHtml(group.label)}</th></tr>` +
        group.items
          .map(
            (item) =>
              `<tr><td>${escapeHtml(item.tooth || "General")}</td><td>${escapeHtml(context.treatmentName(item.treatmentId, item.description))}</td><td>${escapeHtml(item.plannedDate ? formatDate(item.plannedDate) : "—")}</td></tr>`
          )
          .join("")
    )
    .join("")
  const consent = record.dataConsent
  const consentDetail =
    consent.status === "pendiente"
      ? "Pendiente de registrar."
      : `${dataConsentStatusLabels[consent.status]} por ${dataConsentSignerLabels[consent.signer].toLowerCase()}: ${consent.signerName} (cédula ${consent.signerDocumentId}) el ${formatDate(consent.date)}.`
  const requests = record.examRequests
    .map(
      (item) =>
        `<tr><td>${escapeHtml(examKindLabels[item.kind])}</td><td>${escapeHtml(item.detail || "—")}</td><td>${escapeHtml(formatDate(item.requestedAt))}</td><td>${escapeHtml(examRequestStatusLabels[item.status])}</td></tr>`
    )
    .join("")
  const encounters = [...history.encounters]
    .sort(compareEncounters)
    .reverse()
    .map(
      (encounter) =>
        `<tr><td>${escapeHtml(formatDate(encounter.date))}</td><td>${escapeHtml(context.professionalName(encounter))}</td><td>${escapeHtml(encounter.reason)}</td><td>${escapeHtml(diagnosisSummary(encounter))}</td><td>${escapeHtml(performedSummary(encounter, context))}</td></tr>`
    )
    .join("")

  return documentShell(
    `Historia clínica · ${context.patientName}`,
    `<h1>Historia clínica odontológica</h1><p><strong>${escapeHtml(context.patientName)}</strong> · Documento ${escapeHtml(context.documentId)}${context.patient?.clinicalRecordNumber ? ` · ${escapeHtml(context.patient.clinicalRecordNumber)}` : ""}</p>
  <p class="meta">Estado al ${escapeHtml(formatDate(record.updatedAt.slice(0, 10)))}</p>
  ${alertsHtml(record.allergiesAndMedication, "Alertas médicas")}
  ${patientDataHtml(context.patient, record)}
  ${backgroundHtml(record)}
  ${chartSectionsHtml(record.chart, assets.odontogramImage, "Odontograma actual")}
  <h2>Plan de tratamiento por fases</h2>${plan ? `<table><thead><tr><th>Pieza / zona</th><th>Tratamiento</th><th>Fecha prevista</th></tr></thead><tbody>${plan}</tbody></table>` : "<p>Sin tratamientos propuestos.</p>"}
  ${paragraph("Consentimiento de datos", consentDetail)}
  ${declarationHtml(record, context)}
  <h2>Exámenes solicitados</h2>${requests ? `<table><thead><tr><th>Examen</th><th>Detalle</th><th>Solicitado</th><th>Estado</th></tr></thead><tbody>${requests}</tbody></table>` : "<p>Sin exámenes solicitados.</p>"}
  <h2>Archivos asociados</h2>${record.attachments.length ? `<ul>${record.attachments.map((file) => `<li>${escapeHtml(attachmentKindLabels[file.kind])}: ${escapeHtml(file.name)}</li>`).join("")}</ul>` : "<p>Sin archivos.</p>"}
  <h2>Atenciones</h2>${encounters ? `<table><thead><tr><th>Fecha</th><th>Profesional</th><th>Motivo</th><th>Diagnóstico</th><th>Tratamientos realizados</th></tr></thead><tbody>${encounters}</tbody></table>` : "<p>Sin atenciones registradas.</p>"}
  <p class="meta">Los archivos originales se descargan desde la historia clínica. Este documento solo los enumera.</p>`
  )
}

/**
 * Documento HTML de una atención, en el orden del papel: motivo y enfermedad actual, signos vitales,
 * exámenes, dolor y riesgos, diagnósticos, pronóstico, diagnóstico periodontal, tratamientos,
 * materiales, evolución, alertas al momento de la atención, odontograma y notas aclaratorias.
 * Todo dato ingresado por el usuario se escapa.
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
  const sections = encounterSections(encounter)
    .map(
      (section) =>
        `<h2>${escapeHtml(section.title)}</h2>${definitionTable(
          section.items.map((item) => [item.label, Array.isArray(item.value) ? item.value.join("\n") : item.value])
        )}`
    )
    .join("")
  const snapshot = encounter.clinicalSnapshot
  const snapshotHtml = snapshot
    ? `<h2>Alertas al momento de la atención</h2>${alertsHtml(snapshot, "Alertas") || "<p>Sin alertas ni alergias registradas.</p>"}${
        snapshot.medications.length
          ? `<p><strong>Medicación:</strong> ${escapeHtml(snapshot.medications.map((item) => [item.name, item.dose].filter(Boolean).join(" ")).join(" · "))}</p>`
          : ""
      }`
    : ""

  return documentShell(
    `Atención del ${formatDate(encounter.date)} · ${context.patientName}`,
    `<h1>Atención odontológica</h1><p><strong>${escapeHtml(context.patientName)}</strong> · Documento ${escapeHtml(context.documentId)}</p>
  <p class="meta">Fecha: ${escapeHtml(formatDate(encounter.date))} · Profesional: ${escapeHtml(context.professionalName(encounter))} · Registrada el ${escapeHtml(formatDateTime(encounter.createdAt))}</p>
  ${sections}
  <h2>Tratamientos realizados</h2>${treatments ? `<table><thead><tr><th>Pieza / zona</th><th>Tratamiento</th><th>Costo</th></tr></thead><tbody>${treatments}</tbody></table><p>Total: ${escapeHtml(formatCurrency(total))}</p>` : "<p>Sin tratamientos registrados.</p>"}
  ${snapshotHtml}
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
