import { addMonthsToDate, today } from "./today"
import {
  emptyPeriodontalDiagnosis,
  emptyExtraoralExam,
  emptyIntraoralExam,
  emptyVitals,
  type ClinicalSnapshot,
  type Diagnosis,
  type MaintenanceInterval,
} from "../types/encounter-assessment.types"
import type { ClinicalRecord, EncounterFormValues } from "../types/clinical-history.types"

/** Valores iniciales de una atención nueva (también completan las atenciones guardadas antes). */
export function emptyEncounterValues(): EncounterFormValues {
  return {
    date: today(),
    professionalId: "",
    appointmentId: null,
    reason: "",
    presentIllness: "",
    vitals: emptyVitals(),
    asa: "",
    riskAssessment: [],
    extraoralExam: emptyExtraoralExam(),
    intraoralExam: emptyIntraoralExam(),
    pain: { scale: null, location: "", character: "" },
    cariesRisk: { level: "", factors: "" },
    periodontalRisk: { level: "", factors: "" },
    diagnoses: [],
    prognosis: { level: "", notes: "" },
    periodontalDiagnosis: emptyPeriodontalDiagnosis(),
    maintenanceInterval: { option: "", other: "" },
    procedures: "",
    materials: "",
    requestedExams: [],
    examFindings: "",
    evolution: "",
    notes: "",
    nextVisit: "",
    performedTreatments: [],
  }
}

/** El diagnóstico de texto de las atenciones anteriores pasa a ser el primer diagnóstico de la lista. */
export function diagnosesFromText(encounterId: string, text: string): Diagnosis[] {
  return text.trim() ? [{ id: `${encounterId}_dx_1`, description: text.trim(), tooth: "", priority: "" }] : []
}

/** Copia de alertas, alergias y medicación de la historia guardada, para la atención. */
export function clinicalSnapshotOf(record: Pick<ClinicalRecord, "allergiesAndMedication">): ClinicalSnapshot {
  const { alerts, allergies, medications } = record.allergiesAndMedication
  return structuredClone({ alerts, allergies, medications })
}

/** Fecha sugerida para el próximo control según el intervalo de mantenimiento (`null` si es «Otro»). */
export function suggestedNextVisit(date: string, interval: MaintenanceInterval) {
  const months = Number(interval.option)
  return date && Number.isInteger(months) && months > 0 ? addMonthsToDate(date, months) : null
}
