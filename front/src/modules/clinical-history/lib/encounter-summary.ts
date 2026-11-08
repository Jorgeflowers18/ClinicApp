import { formatDateOnly } from "@/shared/lib/date"

import {
  asaLabels,
  bodyMassIndex,
  examKindLabels,
  examStatusLabels,
  extraoralItems,
  intraoralItems,
  maintenanceText,
  periodontalComponents,
  priorityLabels,
  prognosisLabels,
  riskLabels,
  riskLevelLabels,
  type ExamFinding,
  type RiskLevel,
} from "../types/encounter-assessment.types"
import type { EncounterFormValues } from "../types/clinical-history.types"

export interface SummaryItem {
  label: string
  /** Una línea por elemento cuando es una lista. */
  value: string | string[]
}

export interface SummarySection {
  /** Coincide con el paso de «Registrar atención». */
  step: EncounterStepId
  title: string
  items: SummaryItem[]
}

export const encounterSteps = [
  { id: "motivo", label: "Motivo" },
  { id: "signos", label: "Signos vitales y riesgo" },
  { id: "examen", label: "Examen clínico" },
  { id: "diagnostico", label: "Diagnóstico y pronóstico" },
  { id: "tratamientos", label: "Tratamientos y evolución" },
  { id: "revision", label: "Revisión" },
] as const

export type EncounterStepId = (typeof encounterSteps)[number]["id"]

const longDate = (value: string) => formatDateOnly(value, { day: "2-digit", month: "long", year: "numeric" })
const join = (...parts: (string | null | undefined | false)[]) => parts.filter((part) => part && part.trim()).join(" · ")

function measure(value: number | null, unit: string) {
  return value === null || value === undefined ? "" : `${value} ${unit}`
}

/** Estructuras evaluadas del examen (las «No evaluado» no se muestran). */
function examLines(exam: Record<string, ExamFinding>, items: readonly (readonly [string, string])[]) {
  return items.flatMap(([key, label]) => {
    const item = exam[key]
    if (!item || item.status === "no_evaluado") return []
    return [join(`${label}: ${examStatusLabels[item.status]}`, item.status === "alterado" ? item.finding : "")]
  })
}

const riskText = (risk: RiskLevel) => (risk.level ? join(riskLevelLabels[risk.level], risk.factors) : risk.factors.trim())

/**
 * Secciones con datos de una atención, agrupadas como los pasos de «Registrar atención». Las vacías
 * (o «No evaluado») no aparecen. Se usa en la revisión, en la tarjeta de la atención y en su PDF.
 * Los tratamientos realizados y las notas aclaratorias se muestran aparte.
 */
export function encounterSections(encounter: EncounterFormValues): SummarySection[] {
  const { vitals, periodontalDiagnosis: perio } = encounter
  const bmi = bodyMassIndex(vitals)
  const interconsultation = encounter.requestedExams.find((exam) => exam.kind === "interconsulta")

  const sections: SummarySection[] = [
    {
      step: "motivo",
      title: "Motivo de consulta y enfermedad actual",
      items: [
        { label: "Motivo de consulta", value: encounter.reason },
        { label: "Enfermedad actual", value: encounter.presentIllness },
      ],
    },
    {
      step: "signos",
      title: "Signos vitales y evaluación de riesgo",
      items: [
        {
          label: "Signos vitales",
          value: join(
            vitals.bloodPressure && `PA ${vitals.bloodPressure} mmHg`,
            vitals.heartRate !== null && `FC ${vitals.heartRate} lpm`,
            vitals.respiratoryRate !== null && `FR ${vitals.respiratoryRate} rpm`,
            vitals.spo2 !== null && `SpO₂ ${vitals.spo2} %`,
            vitals.temperature !== null && `T ${vitals.temperature} °C`,
            measure(vitals.weight, "kg"),
            measure(vitals.height, "cm"),
            bmi !== null && `IMC ${bmi}`
          ),
        },
        { label: "Clasificación ASA", value: encounter.asa ? asaLabels[encounter.asa] : "" },
        {
          label: "Evaluación de riesgo",
          value: [
            ...encounter.riskAssessment.map((key) => riskLabels[key]),
            ...(interconsultation ? [`Interconsulta requerida: ${interconsultation.detail}`] : []),
          ],
        },
      ],
    },
    {
      step: "examen",
      title: "Examen clínico",
      items: [
        { label: "Examen extraoral", value: examLines(encounter.extraoralExam, extraoralItems) },
        { label: "Examen intraoral", value: examLines(encounter.intraoralExam, intraoralItems) },
        {
          label: "Dolor",
          value: join(encounter.pain.scale !== null && `EVA ${encounter.pain.scale}/10`, encounter.pain.location, encounter.pain.character),
        },
        { label: "Riesgo de caries", value: riskText(encounter.cariesRisk) },
        { label: "Riesgo periodontal", value: riskText(encounter.periodontalRisk) },
      ],
    },
    {
      step: "diagnostico",
      title: "Diagnóstico y pronóstico",
      items: [
        {
          label: "Diagnósticos",
          value: encounter.diagnoses.map((item, index) =>
            join(
              `${index + 1}. ${item.description}`,
              item.tooth && `Pieza / región ${item.tooth}`,
              item.priority && `Prioridad ${priorityLabels[item.priority].toLowerCase()}`
            )
          ),
        },
        {
          label: "Pronóstico",
          value: join(encounter.prognosis.level && prognosisLabels[encounter.prognosis.level], encounter.prognosis.notes),
        },
        {
          label: "Diagnóstico periodontal",
          value: periodontalComponents.flatMap(({ name, label, items }) => {
            const value: string = perio[name]
            const option = (items as readonly (readonly [string, string])[]).find(([key]) => key === value)
            return option ? [`${label}: ${option[1]}`] : []
          }),
        },
        {
          label: "Factores modificadores",
          value: [
            perio.smoking.trim() && `Tabaquismo: ${perio.smoking.trim()}`,
            perio.diabetes.trim() && `Diabetes / HbA1c: ${perio.diabetes.trim()}`,
            perio.otherFactors.trim() && `Otros: ${perio.otherFactors.trim()}`,
          ].filter((line): line is string => Boolean(line)),
        },
        {
          label: "Dientes perdidos por periodontitis",
          value: perio.teethLostToPerio !== null ? String(perio.teethLostToPerio) : "",
        },
        { label: "Intervalo de mantenimiento", value: maintenanceText(encounter.maintenanceInterval) },
      ],
    },
    {
      step: "tratamientos",
      title: "Tratamientos y evolución",
      items: [
        { label: "Procedimientos realizados", value: encounter.procedures },
        { label: "Materiales / anestesia / lote", value: encounter.materials },
        {
          label: "Exámenes solicitados",
          value: encounter.requestedExams.map((exam) => join(examKindLabels[exam.kind], exam.detail)),
        },
        { label: "Hallazgos relevantes de los exámenes", value: encounter.examFindings },
        { label: "Evolución / indicaciones", value: encounter.evolution },
        { label: "Observaciones", value: encounter.notes },
        { label: "Próximo control", value: encounter.nextVisit ? longDate(encounter.nextVisit) : "" },
      ],
    },
  ]

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => (Array.isArray(item.value) ? item.value.length > 0 : item.value.trim().length > 0)),
    }))
    .filter((section) => section.items.length > 0)
}
