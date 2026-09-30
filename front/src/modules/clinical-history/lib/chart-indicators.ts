import { formatDateOnly } from "@/shared/lib/date"

import type { ChartSnapshot, DentalVisit } from "../types/clinical-history.types"

/**
 * Indicadores derivados del estado del odontograma (`getStatusChart()` de react-advanced-odontogram).
 * La librería no exporta sus propios cálculos periodontales y tipa el payload como `any`, así que se
 * lee de forma defensiva. Las piezas se indexan por posición FDI permanente (11–48); una pieza
 * temporal se marca con `toothSelection: "milktooth"` en su posición permanente.
 */
export interface ChartIndicators {
  presentTeeth: number
  missingTeeth: number
  implants: number
  teethWithCaries: number
  teethWithMobility: number
  teethWithFurcation: number
  teethWithCalculus: number
  sitesProbed: number
  sitesWithPocket: number
  sitesWithRecession: number
  /** % de sitios sondeados con sangrado; `null` si no hay sondaje registrado. */
  bleedingPercent: number | null
  /** Índice de placa de O'Leary (% de superficies con placa); `null` si no se evaluó. */
  plaquePercent: number | null
}

/** Profundidad de sondaje a partir de la cual un sitio se considera bolsa periodontal. */
export const POCKET_THRESHOLD_MM = 4

const MISSING = new Set(["none", "no-tooth-after-extraction"])
const NOT_IN_MOUTH = new Set(["implant", "tooth-under-gum"])
const MOBILITY_GRADES = new Set(["m1", "m2", "m3"])

type Raw = Record<string, unknown>
const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const numbers = (value: unknown) => (isObject(value) ? Object.values(value).map(Number).filter(Number.isFinite) : [])

function hasCaries(tooth: Raw) {
  if (Array.isArray(tooth.caries) && tooth.caries.length > 0) return true
  const root = tooth.rootCaries
  return Boolean(root) && root !== "none" && !(Array.isArray(root) && root.length === 0)
}

export function computeChartIndicators(chart: ChartSnapshot | null | undefined): ChartIndicators | null {
  const teeth = chart?.payload?.teeth
  if (!isObject(teeth)) return null

  const result: ChartIndicators = {
    presentTeeth: 0,
    missingTeeth: 0,
    implants: 0,
    teethWithCaries: 0,
    teethWithMobility: 0,
    teethWithFurcation: 0,
    teethWithCalculus: 0,
    sitesProbed: 0,
    sitesWithPocket: 0,
    sitesWithRecession: 0,
    bleedingPercent: null,
    plaquePercent: null,
  }
  let bleedingSites = 0
  let plaqueSurfaces = 0
  let plaqueAssessed = false

  for (const value of Object.values(teeth)) {
    if (!isObject(value)) continue
    const selection = typeof value.toothSelection === "string" ? value.toothSelection : "tooth-base"
    if (MISSING.has(selection)) {
      result.missingTeeth += 1
      continue
    }
    if (selection === "implant") result.implants += 1
    if (NOT_IN_MOUTH.has(selection)) continue

    result.presentTeeth += 1
    if (hasCaries(value)) result.teethWithCaries += 1
    if (typeof value.mobility === "string" && MOBILITY_GRADES.has(value.mobility)) result.teethWithMobility += 1
    if (numbers(value.furcation).some((grade) => grade >= 1)) result.teethWithFurcation += 1
    if (value.calculus === true) result.teethWithCalculus += 1

    if (Array.isArray(value.plaque)) {
      plaqueAssessed = true
      plaqueSurfaces += value.plaque.length
    }

    if (isObject(value.perio)) {
      const depths = isObject(value.perio.pd) ? value.perio.pd : {}
      const probed = Object.entries(depths).filter(([, depth]) => Number(depth) > 0)
      result.sitesProbed += probed.length
      result.sitesWithPocket += probed.filter(([, depth]) => Number(depth) >= POCKET_THRESHOLD_MM).length
      result.sitesWithRecession += numbers(value.perio.gm).filter((margin) => margin > 0).length
      if (Array.isArray(value.perio.bop)) {
        const probedSites = new Set(probed.map(([site]) => site))
        bleedingSites += value.perio.bop.filter((site) => probedSites.has(String(site))).length
      }
    }
  }

  if (result.sitesProbed > 0) result.bleedingPercent = Math.round((bleedingSites / result.sitesProbed) * 100)
  // La librería omite `plaque` cuando la pieza no tiene placa: si hubo sondaje o alguna placa
  // registrada, se asume que la evaluación se hizo en toda la boca.
  if ((plaqueAssessed || result.sitesProbed > 0) && result.presentTeeth > 0) {
    result.plaquePercent = Math.round((plaqueSurfaces / (result.presentTeeth * 4)) * 100)
  }
  return result
}

export interface EvolutionPoint {
  visitId: string
  label: string
  bleedingPercent: number | null
  plaquePercent: number | null
  sitesWithPocket: number
  teethWithMobility: number
  teethWithCaries: number
}

/** Serie cronológica de indicadores para las visitas cerradas que tienen odontograma. */
export function buildEvolutionSeries(visits: DentalVisit[]): EvolutionPoint[] {
  return visits.flatMap((visit) => {
    const indicators = computeChartIndicators(visit.chart)
    if (!indicators) return []
    return [
      {
        visitId: visit.id,
        label: formatDateOnly(visit.date, { day: "2-digit", month: "short", year: "2-digit" }),
        bleedingPercent: indicators.bleedingPercent,
        plaquePercent: indicators.plaquePercent,
        sitesWithPocket: indicators.sitesWithPocket,
        teethWithMobility: indicators.teethWithMobility,
        teethWithCaries: indicators.teethWithCaries,
      },
    ]
  })
}
