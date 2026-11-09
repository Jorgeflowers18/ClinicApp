import { z } from "zod"

import { today } from "../lib/today"

/**
 * Secciones de la historia tomadas del formulario en papel «Historia Clínica Odontológica Integral»
 * (ver documentacion/backlog_HC.md): antecedentes médicos, alergias / medicación / alertas, hábitos,
 * antecedentes odontológicos y periodontales, y declaración de veracidad. Se guardan con la historia.
 */

const labelsOf = <K extends string>(items: readonly (readonly [K, string])[]) =>
  Object.fromEntries(items) as Record<K, string>
const keysOf = <K extends string>(items: readonly (readonly [K, string])[]) =>
  items.map(([key]) => key) as unknown as readonly [K, ...K[]]

const required = (message: string) => z.string().refine((value) => value.trim().length >= 2, message)

// ---------------------------------------------------------------------------------------------
// Antecedentes médicos personales y familiares
// ---------------------------------------------------------------------------------------------

export const medicalConditionItems = [
  ["hipertension", "Hipertensión arterial"],
  ["diabetes", "Diabetes mellitus"],
  ["cardiopatia", "Cardiopatía / arritmia"],
  ["renal", "Enfermedad renal"],
  ["hepatica", "Enfermedad hepática"],
  ["tiroides", "Trastorno tiroideo"],
  ["asma", "Asma / EPOC"],
  ["epilepsia", "Epilepsia / convulsiones"],
  ["hemorragico", "Trastorno hemorrágico"],
  ["anemia", "Anemia"],
  ["osteoporosis", "Osteoporosis"],
  ["cancer", "Cáncer / radioterapia / quimioterapia"],
  ["autoinmune", "Enfermedad autoinmune"],
  ["infectocontagiosa", "Enfermedad infectocontagiosa"],
  ["hospitalizaciones", "Hospitalizaciones previas"],
  ["cirugias", "Cirugías previas"],
  ["embarazo", "Embarazo / lactancia"],
  ["ansiedad", "Ansiedad / depresión"],
  ["otro", "Otro"],
] as const

export type MedicalConditionKey = (typeof medicalConditionItems)[number][0]
export const medicalConditionKeys = keysOf(medicalConditionItems)
export const medicalConditionLabels = labelsOf(medicalConditionItems)

/** Antecedentes que exigen el detalle (cuál, cuándo) cuando se marcan. */
export const conditionsWithDetail: readonly MedicalConditionKey[] = ["hospitalizaciones", "cirugias", "otro"]

export const medicalConditionSchema = z.object({
  personal: z.boolean(),
  family: z.boolean(),
  detail: z.string().max(500, "Máximo 500 caracteres"),
})

export type MedicalCondition = z.infer<typeof medicalConditionSchema>

const conditionsShape = Object.fromEntries(medicalConditionKeys.map((key) => [key, medicalConditionSchema])) as Record<
  MedicalConditionKey,
  typeof medicalConditionSchema
>

export const isConditionMarked = (condition: MedicalCondition) => condition.personal || condition.family

export const medicalBackgroundSchema = z
  .object({
    /** «Niega antecedentes relevantes»: excluyente con el resto. */
    denies: z.boolean(),
    conditions: z.object(conditionsShape),
  })
  .superRefine((background, ctx) => {
    const marked = medicalConditionKeys.filter((key) => isConditionMarked(background.conditions[key]))
    if (background.denies && marked.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["denies"],
        message: "«Niega antecedentes relevantes» no se puede marcar junto con otros antecedentes",
      })
    }
    for (const key of conditionsWithDetail) {
      if (marked.includes(key) && background.conditions[key].detail.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["conditions", key, "detail"],
          message: key === "otro" ? "Describe el antecedente" : "Indica cuál y cuándo",
        })
      }
    }
  })

export type MedicalBackground = z.infer<typeof medicalBackgroundSchema>

export const emptyMedicalBackground = (): MedicalBackground => ({
  denies: false,
  conditions: Object.fromEntries(
    medicalConditionKeys.map((key) => [key, { personal: false, family: false, detail: "" }])
  ) as MedicalBackground["conditions"],
})

// ---------------------------------------------------------------------------------------------
// Alergias, medicamentos y alertas
// ---------------------------------------------------------------------------------------------

export const medicalAlertItems = [
  ["anticoagulantes", "Anticoagulantes / antiagregantes"],
  ["bifosfonatos", "Bifosfonatos / antirresortivos"],
  ["corticoides", "Corticoides"],
  ["inmunosupresores", "Inmunosupresores"],
  ["insulina", "Insulina / hipoglucemiantes"],
  ["profilaxis", "Profilaxis antibiótica indicada"],
  ["marcapasos", "Marcapasos / prótesis valvular"],
  ["latex", "Alergia a látex"],
] as const

export type MedicalAlertKey = (typeof medicalAlertItems)[number][0]
export const medicalAlertKeys = keysOf(medicalAlertItems)
export const medicalAlertLabels = labelsOf(medicalAlertItems)

export const allergySchema = z.object({
  id: z.string(),
  reaction: required("Indica la alergia o reacción"),
  substance: z.string().max(200, "Máximo 200 caracteres"),
  manifestation: z.string().max(300, "Máximo 300 caracteres"),
})

export type Allergy = z.infer<typeof allergySchema>

export const medicationSchema = z.object({
  id: z.string(),
  name: required("Indica el medicamento"),
  dose: z.string().max(200, "Máximo 200 caracteres"),
  indication: z.string().max(300, "Máximo 300 caracteres"),
})

export type Medication = z.infer<typeof medicationSchema>

export const allergiesAndMedicationSchema = z.object({
  allergies: z.array(allergySchema),
  medications: z.array(medicationSchema),
  alerts: z.array(z.enum(medicalAlertKeys)),
})

export type AllergiesAndMedication = z.infer<typeof allergiesAndMedicationSchema>

export const emptyAllergiesAndMedication = (): AllergiesAndMedication => ({ allergies: [], medications: [], alerts: [] })

// ---------------------------------------------------------------------------------------------
// Hábitos y factores de riesgo
// ---------------------------------------------------------------------------------------------

export const yesNoOptions = ["si", "no"] as const
export type YesNo = (typeof yesNoOptions)[number] | ""
export const yesNoLabels: Record<(typeof yesNoOptions)[number], string> = { si: "Sí", no: "No" }

const yesNo = z.enum(["", ...yesNoOptions])

export const bruxismPatterns = [
  ["diurno", "Diurno"],
  ["nocturno", "Nocturno"],
  ["ambos", "Ambos"],
] as const
export const bruxismPatternLabels = labelsOf(bruxismPatterns)

export const hygieneQualities = [
  ["adecuada", "Adecuada"],
  ["deficiente", "Deficiente"],
] as const
export const hygieneQualityLabels = labelsOf(hygieneQualities)

/** Lista provisional: las opciones definitivas las definirá la clínica. */
export const hygieneAidItems = [
  ["cepillo", "Cepillo dental"],
  ["hilo", "Hilo dental"],
  ["interdental", "Cepillo interdental"],
  ["enjuague", "Enjuague bucal"],
  ["irrigador", "Irrigador"],
] as const
export type HygieneAidKey = (typeof hygieneAidItems)[number][0]
export const hygieneAidLabels = labelsOf(hygieneAidItems)

const habitWithDetail = z.object({ answer: yesNo, detail: z.string().max(300, "Máximo 300 caracteres") })

export const habitsSchema = z.object({
  tobacco: habitWithDetail,
  alcohol: habitWithDetail,
  bruxism: z.object({ answer: yesNo, pattern: z.enum(["", ...keysOf(bruxismPatterns)]) }),
  mouthBreathing: z.object({ answer: yesNo }),
  hygiene: z.object({
    answer: yesNo,
    quality: z.enum(["", ...keysOf(hygieneQualities)]),
    brushingPerDay: z
      .number({ invalid_type_error: "Indica un número" })
      .int("Indica un número entero")
      .min(0, "No puede ser negativo")
      .max(10, "Revisa el número de cepillados")
      .nullable(),
    aids: z.array(z.enum(keysOf(hygieneAidItems))),
  }),
  cariogenicDiet: habitWithDetail,
})

export type Habits = z.infer<typeof habitsSchema>

export const emptyHabits = (): Habits => ({
  tobacco: { answer: "", detail: "" },
  alcohol: { answer: "", detail: "" },
  bruxism: { answer: "", pattern: "" },
  mouthBreathing: { answer: "" },
  hygiene: { answer: "", quality: "", brushingPerDay: null, aids: [] },
  cariogenicDiet: { answer: "", detail: "" },
})

// ---------------------------------------------------------------------------------------------
// Antecedentes odontológicos y periodontales
// ---------------------------------------------------------------------------------------------

export const dentalBackgroundItems = [
  ["atencion_previa", "Atención odontológica previa"],
  ["experiencia_negativa", "Experiencia negativa / ansiedad"],
  ["sangrado_gingival", "Sangrado gingival"],
  ["movilidad", "Movilidad dental"],
  ["perdida_dentaria", "Pérdida dentaria"],
  ["trauma", "Trauma dentoalveolar"],
  ["tratamiento_periodontal", "Tratamiento periodontal"],
  ["cirugia_oral", "Cirugía oral"],
  ["implantes", "Implantes"],
  ["ortodoncia", "Ortodoncia"],
  ["endodoncia", "Endodoncia"],
  ["protesis", "Prótesis"],
  ["reaccion_anestesia", "Reacción a anestesia local"],
  ["complicaciones", "Complicaciones posoperatorias"],
] as const
export type DentalBackgroundKey = (typeof dentalBackgroundItems)[number][0]
export const dentalBackgroundLabels = labelsOf(dentalBackgroundItems)

export const dentalBackgroundSchema = z.object({
  items: z.array(z.enum(keysOf(dentalBackgroundItems))),
  /** Última consulta, tratamientos realizados y observaciones. */
  notes: z.string().max(1000, "Máximo 1000 caracteres"),
})

export type DentalBackground = z.infer<typeof dentalBackgroundSchema>

export const emptyDentalBackground = (): DentalBackground => ({ items: [], notes: "" })

/** Solo los elementos nuevos de la sección 18; los repetidos se muestran desde su sección original. */
export const periodontalBackgroundItems = [
  ["sangrado_espontaneo", "Sangrado espontáneo"],
  ["sangrado_cepillado", "Sangrado al cepillado"],
  ["halitosis", "Halitosis"],
  ["supuracion", "Supuración"],
  ["migracion", "Migración dentaria"],
  ["sensibilidad_radicular", "Sensibilidad radicular"],
  ["dolor_gingival", "Dolor gingival"],
  ["perdida_periodontitis", "Pérdida dentaria por periodontitis"],
  ["historia_familiar", "Historia familiar de periodontitis"],
  ["estres", "Estrés"],
] as const
export type PeriodontalBackgroundKey = (typeof periodontalBackgroundItems)[number][0]
export const periodontalBackgroundLabels = labelsOf(periodontalBackgroundItems)

export const periodontalBackgroundSchema = z.object({
  items: z.array(z.enum(keysOf(periodontalBackgroundItems))),
})

export type PeriodontalBackground = z.infer<typeof periodontalBackgroundSchema>

export const emptyPeriodontalBackground = (): PeriodontalBackground => ({ items: [] })

// ---------------------------------------------------------------------------------------------
// Declaración de veracidad
// ---------------------------------------------------------------------------------------------

export const truthDeclarationText =
  "Declaro que la información suministrada es verdadera y completa. Me comprometo a informar cualquier cambio en mi estado de salud, medicamentos, embarazo, alergias o indicaciones médicas antes de cada atención."

export const truthDeclarationSchema = z
  .object({
    accepted: z.boolean(),
    signer: z.enum(["paciente", "representante"]),
    signerName: z.string(),
    signerDocumentId: z.string(),
    date: z.string(),
    professionalId: z.string(),
  })
  .superRefine((declaration, ctx) => {
    if (!declaration.accepted) return
    if (declaration.signerName.trim().length < 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["signerName"], message: "Indica el nombre del paciente o representante" })
    }
    if (declaration.signerDocumentId.trim().length < 5) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["signerDocumentId"], message: "Indica la C.I." })
    }
    if (!declaration.date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "Indica la fecha" })
    } else if (declaration.date > today()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "La fecha no puede ser futura" })
    }
  })

export type TruthDeclaration = z.infer<typeof truthDeclarationSchema>

export const emptyTruthDeclaration = (): TruthDeclaration => ({
  accepted: false,
  signer: "paciente",
  signerName: "",
  signerDocumentId: "",
  date: "",
  professionalId: "",
})
