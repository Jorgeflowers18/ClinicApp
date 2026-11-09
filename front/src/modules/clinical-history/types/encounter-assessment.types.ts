import { z } from "zod"

import { allergySchema, medicalAlertKeys, medicationSchema } from "./background.types"

/**
 * Evaluación clínica de una atención, tomada del formulario en papel (ver documentacion/backlog_HC.md):
 * signos vitales, ASA, riesgo, exámenes extraoral e intraoral, dolor, riesgos, diagnósticos,
 * pronóstico, diagnóstico periodontal 2017, intervalo de mantenimiento y exámenes solicitados.
 */

const labelsOf = <K extends string>(items: readonly (readonly [K, string])[]) =>
  Object.fromEntries(items) as Record<K, string>
const keysOf = <K extends string>(items: readonly (readonly [K, string])[]) =>
  items.map(([key]) => key) as unknown as readonly [K, ...K[]]
const optionalOf = <K extends string>(items: readonly (readonly [K, string])[]) => z.enum(["", ...keysOf(items)])

const shortText = z.string().max(500, "Máximo 500 caracteres")

function measure(label: string, min: number, max: number, integer = false) {
  let schema = z.number({ invalid_type_error: `Indica ${label}` }).min(min, `Valor entre ${min} y ${max}`).max(max, `Valor entre ${min} y ${max}`)
  if (integer) schema = schema.int("Indica un número entero")
  return schema.nullable()
}

// ---------------------------------------------------------------------------------------------
// Signos vitales y evaluación de riesgo
// ---------------------------------------------------------------------------------------------

export const vitalsSchema = z.object({
  bloodPressure: z
    .string()
    .refine((value) => !value.trim() || /^\d{2,3}\/\d{2,3}$/.test(value.trim()), "Formato 120/80"),
  heartRate: measure("la frecuencia cardíaca", 30, 220, true),
  respiratoryRate: measure("la frecuencia respiratoria", 5, 60, true),
  spo2: measure("la saturación", 50, 100, true),
  temperature: measure("la temperatura", 34, 42),
  weight: measure("el peso", 1, 300),
  height: measure("la talla", 30, 250),
})

export type Vitals = z.infer<typeof vitalsSchema>

export const emptyVitals = (): Vitals => ({
  bloodPressure: "",
  heartRate: null,
  respiratoryRate: null,
  spo2: null,
  temperature: null,
  weight: null,
  height: null,
})

/** IMC con un decimal; `null` si falta el peso o la talla. */
export function bodyMassIndex(vitals: Pick<Vitals, "weight" | "height">) {
  if (!vitals.weight || !vitals.height) return null
  const meters = vitals.height / 100
  return Math.round((vitals.weight / (meters * meters)) * 10) / 10
}

export const asaItems = [
  ["I", "ASA I"],
  ["II", "ASA II"],
  ["III", "ASA III"],
  ["IV", "ASA IV"],
] as const
export const asaLabels = labelsOf(asaItems)

/** «Interconsulta requerida» no está aquí: es el examen solicitado «Interconsulta médica». */
export const riskItems = [
  ["hemorragico", "Riesgo hemorrágico"],
  ["infeccioso", "Riesgo infeccioso"],
  ["ambulatorio", "Apto para atención ambulatoria"],
] as const
export type RiskKey = (typeof riskItems)[number][0]
export const riskLabels = labelsOf(riskItems)

// ---------------------------------------------------------------------------------------------
// Examen extraoral e intraoral
// ---------------------------------------------------------------------------------------------

export const examStatusItems = [
  ["normal", "Normal"],
  ["alterado", "Alterado"],
  ["no_evaluado", "No evaluado"],
] as const
export type ExamStatus = (typeof examStatusItems)[number][0]
export const examStatusLabels = labelsOf(examStatusItems)

export const extraoralItems = [
  ["simetria", "Simetría facial"],
  ["ganglios", "Ganglios"],
  ["atm", "ATM / ruidos / dolor"],
  ["apertura", "Apertura bucal / desviación"],
  ["musculos", "Músculos masticatorios"],
  ["piel_labios", "Piel y labios"],
] as const
export type ExtraoralKey = (typeof extraoralItems)[number][0]
export const extraoralLabels = labelsOf(extraoralItems)

export const intraoralItems = [
  ["mucosa", "Mucosa labial / yugal"],
  ["paladar", "Paladar / orofaringe"],
  ["lengua", "Lengua / piso de boca"],
  ["glandulas", "Glándulas salivales / flujo"],
  ["frenillos", "Frenillos"],
  ["encia", "Encía / periodonto"],
  ["oclusion", "Oclusión"],
  ["protesis", "Prótesis / aparatos"],
] as const
export type IntraoralKey = (typeof intraoralItems)[number][0]
export const intraoralLabels = labelsOf(intraoralItems)

export const examFindingSchema = z.object({ status: z.enum(keysOf(examStatusItems)), finding: shortText })
export type ExamFinding = z.infer<typeof examFindingSchema>

function examSchema<K extends string>(keys: readonly K[]) {
  const shape = Object.fromEntries(keys.map((key) => [key, examFindingSchema])) as Record<K, typeof examFindingSchema>
  return z.object(shape).superRefine((exam, ctx) => {
    for (const key of keys) {
      const item = (exam as Record<K, ExamFinding>)[key]
      if (item.status === "alterado" && item.finding.trim().length < 3) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key, "finding"], message: "Describe el hallazgo" })
      }
    }
  })
}

export const extraoralExamSchema = examSchema(keysOf(extraoralItems))
export const intraoralExamSchema = examSchema(keysOf(intraoralItems))
export type ExtraoralExam = Record<ExtraoralKey, ExamFinding>
export type IntraoralExam = Record<IntraoralKey, ExamFinding>

function emptyExam<K extends string>(items: readonly (readonly [K, string])[]) {
  return Object.fromEntries(items.map(([key]) => [key, { status: "no_evaluado", finding: "" }])) as Record<K, ExamFinding>
}
export const emptyExtraoralExam = (): ExtraoralExam => emptyExam(extraoralItems)
export const emptyIntraoralExam = (): IntraoralExam => emptyExam(intraoralItems)

// ---------------------------------------------------------------------------------------------
// Dolor y riesgos
// ---------------------------------------------------------------------------------------------

export const painSchema = z.object({
  scale: measure("la intensidad", 0, 10, true),
  location: shortText,
  character: shortText,
})
export type Pain = z.infer<typeof painSchema>

export const riskLevelItems = [
  ["bajo", "Bajo"],
  ["moderado", "Moderado"],
  ["alto", "Alto"],
] as const
export const riskLevelLabels = labelsOf(riskLevelItems)

export const riskLevelSchema = z.object({ level: optionalOf(riskLevelItems), factors: shortText })
export type RiskLevel = z.infer<typeof riskLevelSchema>

// ---------------------------------------------------------------------------------------------
// Diagnósticos y pronóstico
// ---------------------------------------------------------------------------------------------

export const priorityItems = [
  ["alta", "Alta"],
  ["media", "Media"],
  ["baja", "Baja"],
] as const
export const priorityLabels = labelsOf(priorityItems)

export const diagnosisSchema = z.object({
  id: z.string(),
  /** Diagnóstico clínico o código CIE-10, en texto libre. */
  description: z.string().refine((value) => value.trim().length >= 3, "Describe el diagnóstico"),
  tooth: z.string().max(60, "Máximo 60 caracteres"),
  /** Vacío solo en diagnósticos convertidos de atenciones anteriores. */
  priority: optionalOf(priorityItems),
})
export type Diagnosis = z.infer<typeof diagnosisSchema>

export const prognosisItems = [
  ["favorable", "Favorable"],
  ["reservado", "Reservado"],
  ["desfavorable", "Desfavorable"],
  ["depende", "Depende de adherencia o control sistémico"],
] as const
export const prognosisLabels = labelsOf(prognosisItems)

export const prognosisSchema = z.object({
  level: optionalOf(prognosisItems),
  /** Pronóstico general y por piezas. */
  notes: z.string().max(1000, "Máximo 1000 caracteres"),
})
export type Prognosis = z.infer<typeof prognosisSchema>

export const gingivalItems = [
  ["salud", "Salud"],
  ["gingivitis", "Gingivitis inducida por biofilm"],
  ["no_inducida", "No inducida"],
] as const
export const stageItems = [
  ["I", "Estadio I"],
  ["II", "Estadio II"],
  ["III", "Estadio III"],
  ["IV", "Estadio IV"],
] as const
export const extentItems = [
  ["localizada", "Localizada (<30%)"],
  ["generalizada", "Generalizada"],
  ["molar_incisivo", "Patrón molar-incisivo"],
] as const
export const gradeItems = [
  ["A", "Grado A"],
  ["B", "Grado B"],
  ["C", "Grado C"],
] as const
export const stabilityItems = [
  ["estable", "Estable"],
  ["remision", "En remisión o control"],
  ["inestable", "Inestable"],
] as const
export const periImplantItems = [
  ["salud", "Salud"],
  ["mucositis", "Mucositis"],
  ["periimplantitis", "Periimplantitis"],
  ["deficiencia", "Deficiencia de tejidos"],
] as const

/** Componentes del diagnóstico periodontal 2017, en el orden del papel. */
export const periodontalComponents = [
  { name: "gingival", label: "Salud gingival / gingivitis", items: gingivalItems },
  { name: "stage", label: "Periodontitis", items: stageItems },
  { name: "extent", label: "Extensión", items: extentItems },
  { name: "grade", label: "Grado", items: gradeItems },
  { name: "stability", label: "Estabilidad", items: stabilityItems },
  { name: "periImplant", label: "Enfermedades periimplantarias", items: periImplantItems },
] as const

export const periodontalDiagnosisSchema = z.object({
  gingival: optionalOf(gingivalItems),
  stage: optionalOf(stageItems),
  extent: optionalOf(extentItems),
  grade: optionalOf(gradeItems),
  stability: optionalOf(stabilityItems),
  periImplant: optionalOf(periImplantItems),
  smoking: shortText,
  diabetes: shortText,
  otherFactors: shortText,
  /** Dientes perdidos por periodontitis: no se puede deducir del odontograma. */
  teethLostToPerio: measure("el número de dientes", 0, 32, true),
})
export type PeriodontalDiagnosis = z.infer<typeof periodontalDiagnosisSchema>

export const emptyPeriodontalDiagnosis = (): PeriodontalDiagnosis => ({
  gingival: "",
  stage: "",
  extent: "",
  grade: "",
  stability: "",
  periImplant: "",
  smoking: "",
  diabetes: "",
  otherFactors: "",
  teethLostToPerio: null,
})

export const maintenanceItems = [
  ["3", "3 meses"],
  ["4", "4 meses"],
  ["6", "6 meses"],
  ["otro", "Otro"],
] as const
export const maintenanceLabels = labelsOf(maintenanceItems)

export const maintenanceIntervalSchema = z
  .object({ option: optionalOf(maintenanceItems), other: z.string().max(100, "Máximo 100 caracteres") })
  .refine((value) => value.option !== "otro" || value.other.trim().length >= 2, {
    message: "Indica el intervalo",
    path: ["other"],
  })
export type MaintenanceInterval = z.infer<typeof maintenanceIntervalSchema>

export function maintenanceText(interval: MaintenanceInterval) {
  if (!interval.option) return ""
  return interval.option === "otro" ? interval.other.trim() : maintenanceLabels[interval.option]
}

// ---------------------------------------------------------------------------------------------
// Exámenes complementarios
// ---------------------------------------------------------------------------------------------

export const examKindItems = [
  ["radiografia_periapical", "Radiografía periapical"],
  ["bitewing", "Bitewing"],
  ["panoramica", "Panorámica"],
  ["cbct", "CBCT"],
  ["fotografias", "Fotografías clínicas"],
  ["modelos", "Modelos / escaneo intraoral"],
  ["pruebas_pulpares", "Pruebas pulpares"],
  ["laboratorio", "Laboratorio clínico"],
  ["interconsulta", "Interconsulta médica"],
  ["biopsia", "Biopsia / histopatología"],
] as const
export type ExamKind = (typeof examKindItems)[number][0]
export const examKindKeys = keysOf(examKindItems)
export const examKindLabels = labelsOf(examKindItems)

export const requestedExamSchema = z
  .object({
    id: z.string(),
    kind: z.enum(examKindKeys),
    /** Detalle opcional; en la interconsulta, el especialista o el motivo. */
    detail: z.string().max(300, "Máximo 300 caracteres"),
  })
  .refine((exam) => exam.kind !== "interconsulta" || exam.detail.trim().length >= 3, {
    message: "Indica el especialista o el motivo de la interconsulta",
    path: ["detail"],
  })
export type RequestedExam = z.infer<typeof requestedExamSchema>

// ---------------------------------------------------------------------------------------------
// Copia de alertas al momento de la atención
// ---------------------------------------------------------------------------------------------

export const clinicalSnapshotSchema = z.object({
  alerts: z.array(z.enum(medicalAlertKeys)),
  allergies: z.array(allergySchema),
  medications: z.array(medicationSchema),
})
/** Alertas, alergias y medicación vigentes en la historia guardada al registrar la atención. */
export type ClinicalSnapshot = z.infer<typeof clinicalSnapshotSchema>
