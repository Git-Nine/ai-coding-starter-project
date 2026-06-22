import type { Plant, MaintenanceLevel, Soil } from '@/lib/plants'
import type { SunExposure, Surface, SpaceType } from '@/lib/scans'

/**
 * Plan contract for PROJ-6 (Rule-Based Plan Generation).
 *
 * A scan has at most ONE plan (1:1). A plan stores a snapshot of the conditions it
 * was generated from (so the plan view is self-contained and PROJ-7 can detect
 * staleness) plus its lines in `plan_plants`. The rule engine that fills these
 * lives in `src/lib/plan-engine.ts`. The UI is built against this contract; reads
 * and writes error until the PROJ-6 backend migration creates the tables (same
 * staged flow as PROJ-2/3/4/5).
 */

export const PLANS_TABLE = 'plans'
export const PLAN_PLANTS_TABLE = 'plan_plants'

/** A row of public.plans as the UI reads it. */
export type Plan = {
  id: string
  scan_id: string
  user_id: string
  // Snapshot of the inputs the plan was generated from.
  snapshot_sun: SunExposure
  snapshot_area_sqm: number
  snapshot_surface: Surface
  snapshot_space_type: SpaceType
  snapshot_soil: Soil | null
  snapshot_zone: number | null
  snapshot_maintenance: MaintenanceLevel | null
  // Plan-level flags / counts.
  zone_unconfirmed: boolean
  extra_match_count: number
  created_at: string
  updated_at: string | null
}

/** A row of public.plan_plants — one chosen plant + its recommended quantity. */
export type PlanPlant = {
  id: string
  plan_id: string
  plant_id: string
  quantity: number
  sort_order: number
  /** Whether this plant may not suit the site's soil (computed at generation time). */
  soil_flag: boolean
  created_at: string
}

/** plan_plants joined with its plant — the shape the plan view reads. */
export type PlanPlantWithPlant = PlanPlant & { plants: Plant | null }

/** True when the scan's surface needs clearing/prep before planting (gravel/paved). */
export function needsPrep(surface: Surface): boolean {
  return surface === 'gravel' || surface === 'paved'
}
