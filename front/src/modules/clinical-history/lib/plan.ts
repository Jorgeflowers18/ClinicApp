import {
  treatmentPhaseLabels,
  treatmentPhases,
  type ProposedTreatment,
  type TreatmentPhase,
} from "../types/clinical-history.types"

/** Valor del selector para «Sin fase» (el selector no admite el valor vacío). */
export const NO_PHASE = "__sin_fase__"

export const phaseItems: Record<string, string> = {
  [NO_PHASE]: "Sin fase",
  ...Object.fromEntries(treatmentPhases.map((phase) => [phase, treatmentPhaseLabels[phase]])),
}

export const phaseLabel = (phase: TreatmentPhase | "") => (phase ? treatmentPhaseLabels[phase] : "Sin fase")

export interface PlanPhaseGroup<T> {
  phase: TreatmentPhase | ""
  label: string
  items: T[]
}

/** Agrupa los propuestos por fase, en el orden del papel; «Sin fase» va al final. */
export function groupPlanByPhase<T extends Pick<ProposedTreatment, "phase">>(plan: readonly T[]): PlanPhaseGroup<T>[] {
  return ([...treatmentPhases, ""] as const)
    .map((phase) => ({ phase, label: phaseLabel(phase), items: plan.filter((item) => item.phase === phase) }))
    .filter((group) => group.items.length > 0)
}
