import { LAYER_DISPLAY_ORDER } from '@/lib/plants'
import type { Plant, PlantType, MaintenanceLevel, Soil } from '@/lib/plants'
import type { Scan, ScanEnrichment, SunExposure, Surface, SpaceType } from '@/lib/scans'

/**
 * PROJ-6 rule engine — a PURE, deterministic calculation.
 *
 * Same inputs (scan + enrichment + catalogue + maintenance preference) always
 * produce the same plan, so results are trustworthy and unit-testable, and PROJ-7
 * reuses this exact module for its interactive editing. No I/O, no Date/random.
 *
 * Pipeline: hard filters (sun, winter zone, physical fit) → eligible layers by
 * area (~60/30/10) → area-scaled richness target → native-first ranking within
 * each layer → quantities that fill each layer's area at mature spread.
 */

// ---- Tunable constants (see spec "Engine constants") ----
/** Layers need a minimum area before they're offered (no trees on a balcony). */
export const SHRUB_MIN_AREA_SQM = 4
export const TREE_MIN_AREA_SQM = 15
/** Species richness scales with area between these bounds. */
export const RICHNESS_FLOOR = 4
export const RICHNESS_CEILING = 12
/** Area (m²) at which richness == floor; ~+1 species per doubling above this. */
export const RICHNESS_AREA_BASE = 3
/** Paved/gravel → plant about half as densely (feature/container style). */
export const PAVED_DENSITY_FACTOR = 0.5
/** Upper bound on total plants in a plan. */
export const TOTAL_QUANTITY_CAP = 200
/** Area-allocation weights per layer (groundcover+perennial = 60, shrub 30, tree 10). */
const LAYER_WEIGHT: Record<PlantType, number> = {
  groundcover: 30,
  perennial: 30,
  shrub: 30,
  tree: 10,
}

export type PlanReasons = { native: boolean; maintenanceMatch: boolean }

export type GeneratedLine = {
  plant: Plant
  layer: PlantType
  quantity: number
  soilFlag: boolean
  reasons: PlanReasons
  sortOrder: number
}

export type PlanSnapshot = {
  sun: SunExposure
  area_sqm: number
  surface: Surface
  space_type: SpaceType
  soil: Soil | null
  zone: number | null
  maintenance: MaintenanceLevel | null
}

export type GeneratedPlan = {
  lines: GeneratedLine[]
  extraMatchCount: number
  zoneUnconfirmed: boolean
  prepNote: boolean
  isEmpty: boolean
  snapshot: PlanSnapshot
}

export type GeneratePlanInput = {
  scan: Pick<Scan, 'sun_exposure' | 'area_sqm' | 'surface' | 'space_type'>
  enrichment: Pick<
    ScanEnrichment,
    'soil_type' | 'soil_status' | 'hardiness_zone' | 'zone_status'
  > | null
  catalogue: Plant[]
  maintenancePreference: MaintenanceLevel | null
}

/** Mature footprint in m² (plants just touch at maturity). */
export function footprintSqm(plant: Pick<Plant, 'mature_spread_cm'>): number {
  const m = plant.mature_spread_cm / 100
  return m * m
}

/** Target species richness for a given area — floor..ceiling, ~+1 per doubling. */
export function richnessForArea(areaSqm: number): number {
  const raw =
    RICHNESS_FLOOR + Math.floor(Math.log2(Math.max(areaSqm, RICHNESS_AREA_BASE) / RICHNESS_AREA_BASE))
  return Math.min(RICHNESS_CEILING, Math.max(RICHNESS_FLOOR, raw))
}

function layerEligible(layer: PlantType, areaSqm: number): boolean {
  if (layer === 'groundcover' || layer === 'perennial') return true
  if (layer === 'shrub') return areaSqm >= SHRUB_MIN_AREA_SQM
  return areaSqm >= TREE_MIN_AREA_SQM // tree
}

/** Order a layer's survivors: native → soil-match → maintenance-match → compact (balcony) → name. */
function rankLayer(
  plants: Plant[],
  soil: Soil | null,
  maintenance: MaintenanceLevel | null,
  spaceType: SpaceType,
): Plant[] {
  return [...plants].sort((a, b) => {
    if (a.native !== b.native) return a.native ? -1 : 1
    if (soil) {
      const am = a.soil_compatibility.includes(soil) ? 0 : 1
      const bm = b.soil_compatibility.includes(soil) ? 0 : 1
      if (am !== bm) return am - bm
    }
    if (maintenance) {
      const am = a.maintenance_level === maintenance ? 0 : 1
      const bm = b.maintenance_level === maintenance ? 0 : 1
      if (am !== bm) return am - bm
    }
    if (spaceType === 'balcony' && a.mature_spread_cm !== b.mature_spread_cm) {
      return a.mature_spread_cm - b.mature_spread_cm
    }
    return a.latin_name.localeCompare(b.latin_name)
  })
}

/** Distribute the richness target across the present layers (weighted, ≥1 each, capped by availability). */
function speciesSharePerLayer(
  presentLayers: PlantType[],
  byLayer: Map<PlantType, Plant[]>,
  richness: number,
): Map<PlantType, number> {
  const totalWeight = presentLayers.reduce((s, l) => s + LAYER_WEIGHT[l], 0)
  const share = new Map<PlantType, number>()
  for (const l of presentLayers) {
    const raw = Math.max(1, Math.round((richness * LAYER_WEIGHT[l]) / totalWeight))
    share.set(l, Math.min(raw, byLayer.get(l)!.length))
  }

  const avail = (l: PlantType) => byLayer.get(l)!.length
  const sum = () => presentLayers.reduce((s, l) => s + share.get(l)!, 0)
  const totalAvail = presentLayers.reduce((s, l) => s + avail(l), 0)
  const target = Math.min(richness, totalAvail)

  let guard = 0
  while (sum() < target && guard++ < 1000) {
    // add to the layer with the most remaining capacity (tiebreak: display order)
    let best: PlantType | null = null
    let bestRemaining = 0
    for (const l of LAYER_DISPLAY_ORDER) {
      if (!share.has(l)) continue
      const remaining = avail(l) - share.get(l)!
      if (remaining > bestRemaining) {
        best = l
        bestRemaining = remaining
      }
    }
    if (!best) break
    share.set(best, share.get(best)! + 1)
  }
  guard = 0
  while (sum() > target && guard++ < 1000) {
    // remove from the largest share above 1 (tiebreak: reverse display order)
    let best: PlantType | null = null
    for (let i = LAYER_DISPLAY_ORDER.length - 1; i >= 0; i--) {
      const l = LAYER_DISPLAY_ORDER[i]
      if (!share.has(l) || share.get(l)! <= 1) continue
      if (best === null || share.get(l)! > share.get(best)!) best = l
    }
    if (!best) break
    share.set(best, share.get(best)! - 1)
  }
  return share
}

/** Scale quantities down to the cap, keeping at least one of each chosen plant. */
function applyCap(lines: GeneratedLine[], cap: number): void {
  let total = lines.reduce((s, l) => s + l.quantity, 0)
  if (total <= cap) return
  const factor = cap / total
  for (const l of lines) l.quantity = Math.max(1, Math.floor(l.quantity * factor))
  total = lines.reduce((s, l) => s + l.quantity, 0)
  let guard = 0
  while (total > cap && guard++ < 100000) {
    let largest: GeneratedLine | null = null
    for (const l of lines) {
      if (l.quantity > 1 && (largest === null || l.quantity > largest.quantity)) largest = l
    }
    if (!largest) break
    largest.quantity -= 1
    total -= 1
  }
}

export function generatePlan(input: GeneratePlanInput): GeneratedPlan {
  const { scan, enrichment, catalogue, maintenancePreference } = input

  const soil: Soil | null =
    enrichment && enrichment.soil_status === 'success' ? enrichment.soil_type : null
  const parsedZone =
    enrichment && enrichment.zone_status === 'success' && enrichment.hardiness_zone != null
      ? Number.parseInt(enrichment.hardiness_zone, 10)
      : NaN
  const zone = Number.isNaN(parsedZone) ? null : parsedZone
  const zoneUnconfirmed = zone === null

  const area = scan.area_sqm
  const prepNote = scan.surface === 'gravel' || scan.surface === 'paved'
  const densityFactor = prepNote ? PAVED_DENSITY_FACTOR : 1

  const snapshot: PlanSnapshot = {
    sun: scan.sun_exposure,
    area_sqm: area,
    surface: scan.surface,
    space_type: scan.space_type,
    soil,
    zone,
    maintenance: maintenancePreference,
  }

  // 1. Hard filters: sun, winter zone (when known), physical fit.
  const survivors = catalogue.filter((p) => {
    if (!p.sun_tolerance.includes(scan.sun_exposure)) return false
    if (zone !== null && zone < p.min_hardiness_zone) return false
    if (footprintSqm(p) > area) return false
    return true
  })

  const empty = (): GeneratedPlan => ({
    lines: [],
    extraMatchCount: 0,
    zoneUnconfirmed,
    prepNote,
    isEmpty: true,
    snapshot,
  })

  if (survivors.length === 0) return empty()

  // 2. Eligible layers by area, survivors grouped + ranked within each.
  const byLayer = new Map<PlantType, Plant[]>()
  for (const layer of LAYER_DISPLAY_ORDER) {
    if (!layerEligible(layer, area)) continue
    const members = survivors.filter((p) => p.plant_type === layer)
    if (members.length) {
      byLayer.set(layer, rankLayer(members, soil, maintenancePreference, scan.space_type))
    }
  }
  const presentLayers = LAYER_DISPLAY_ORDER.filter((l) => byLayer.has(l))
  // All survivors fell into ineligible layers (e.g. only trees survive on a tiny plot).
  if (presentLayers.length === 0) return empty()

  // 3. Richness target + per-layer species share.
  const richness = richnessForArea(area)
  const share = speciesSharePerLayer(presentLayers, byLayer, richness)

  // 4. Area allocation per layer (same weights as the species split).
  const totalWeight = presentLayers.reduce((s, l) => s + LAYER_WEIGHT[l], 0)

  // 5. Choose species + compute quantities.
  const lines: GeneratedLine[] = []
  let sortOrder = 0
  for (const layer of LAYER_DISPLAY_ORDER) {
    if (!byLayer.has(layer)) continue
    const chosen = byLayer.get(layer)!.slice(0, share.get(layer)!)
    if (chosen.length === 0) continue
    const layerArea = (area * LAYER_WEIGHT[layer]) / totalWeight
    const perSpeciesArea = layerArea / chosen.length
    for (const plant of chosen) {
      const qty = Math.max(1, Math.round((perSpeciesArea / footprintSqm(plant)) * densityFactor))
      lines.push({
        plant,
        layer,
        quantity: qty,
        soilFlag: soil !== null && !plant.soil_compatibility.includes(soil),
        reasons: {
          native: plant.native,
          maintenanceMatch:
            maintenancePreference !== null && plant.maintenance_level === maintenancePreference,
        },
        sortOrder: sortOrder++,
      })
    }
  }

  if (lines.length === 0) return empty()

  // 6. Global quantity cap.
  applyCap(lines, TOTAL_QUANTITY_CAP)

  return {
    lines,
    extraMatchCount: survivors.length - lines.length,
    zoneUnconfirmed,
    prepNote,
    isEmpty: false,
    snapshot,
  }
}
