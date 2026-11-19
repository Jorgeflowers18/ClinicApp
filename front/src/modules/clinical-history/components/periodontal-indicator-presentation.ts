import { POCKET_THRESHOLD_MM, type ChartIndicators, type EvolutionPoint } from "../lib/chart-indicators"

/** Presentation only: an existing count is meaningful only when probing was recorded. */
export function evaluatedPocketCount(indicators: ChartIndicators | null | undefined): number | null {
  if (!indicators || !Number.isFinite(indicators.sitesProbed) || indicators.sitesProbed <= 0) return null
  if (indicators.maxProbingDepth === null || !Number.isFinite(indicators.maxProbingDepth) || indicators.maxProbingDepth <= 0) return null
  return Number.isFinite(indicators.sitesWithPocket) && indicators.sitesWithPocket >= 0 ? indicators.sitesWithPocket : null
}

/** Missing probing is a gap in the external evolution chart, never a fabricated zero. */
export function evolutionPocketReading(point: EvolutionPoint) {
  return point.maxProbingDepth !== null && Number.isFinite(point.maxProbingDepth) && point.maxProbingDepth > 0
    ? point.sitesWithPocket : undefined
}

export function pocketCountHint(indicators: ChartIndicators | null | undefined) {
  const count = evaluatedPocketCount(indicators)
  return `Bolsas ≥ ${POCKET_THRESHOLD_MM} mm: ${count === null ? "Sin evaluar" : `${count} ${count === 1 ? "sitio" : "sitios"}`}`
}
