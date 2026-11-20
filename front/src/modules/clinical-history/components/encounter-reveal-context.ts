import { createContext } from "react"
import type { EncounterStepId } from "../lib/encounter-summary"

export interface EncounterReveal { step: EncounterStepId; field: string; version: number }
export const EncounterRevealContext = createContext<EncounterReveal | null>(null)
