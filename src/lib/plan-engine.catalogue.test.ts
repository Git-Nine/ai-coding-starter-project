import { describe, it, expect } from 'vitest'
import { generatePlan, type GeneratePlanInput, TOTAL_QUANTITY_CAP } from './plan-engine'
import type { Plant } from './plants'
// The real seeded catalogue — the exact data PROJ-6 plans from in production.
import { PLANTS } from '../../scripts/seed-plants.mjs'

/**
 * QA (PROJ-6): runs the engine against the REAL seed catalogue (40 plants) rather
 * than synthetic fixtures, to confirm realistic plans come out sane — non-empty,
 * layered, native-led, quantities ≥1 and within the cap, deterministic.
 */

const catalogue: Plant[] = (PLANTS as Record<string, unknown>[]).map((p, i) => ({
  id: `seed-${i}`,
  created_at: '2026-06-22',
  updated_at: null,
  image_url: null,
  care_notes: null,
  ...p,
})) as Plant[]

const enrichment = (over: Partial<NonNullable<GeneratePlanInput['enrichment']>> = {}) =>
  ({ soil_type: 'loam', soil_status: 'success', hardiness_zone: '7', zone_status: 'success', ...over }) as GeneratePlanInput['enrichment']

describe('plan engine × real seed catalogue', () => {
  it('produces a sane layered plan for a medium full-sun garden', () => {
    const plan = generatePlan({
      scan: { sun_exposure: 'full', area_sqm: 30, surface: 'soil', space_type: 'back_garden' },
      enrichment: enrichment(),
      catalogue,
      maintenancePreference: 'low',
    })
    expect(plan.isEmpty).toBe(false)
    expect(plan.lines.length).toBeGreaterThanOrEqual(3)
    // Every line has a real plant, quantity ≥ 1, and a known layer.
    expect(plan.lines.every((l) => l.quantity >= 1 && l.plant.id)).toBe(true)
    // More than one structural layer represented (the catalogue supports it).
    expect(new Set(plan.lines.map((l) => l.layer)).size).toBeGreaterThan(1)
    // Total within the cap.
    expect(plan.lines.reduce((s, l) => s + l.quantity, 0)).toBeLessThanOrEqual(TOTAL_QUANTITY_CAP)
    // Native-led (the catalogue is native-rich; with native-first most picks are native).
    expect(plan.lines.filter((l) => l.plant.native).length).toBeGreaterThan(0)
  })

  it('keeps a small balcony tree-free and compact', () => {
    const plan = generatePlan({
      scan: { sun_exposure: 'full', area_sqm: 3, surface: 'paved', space_type: 'balcony' },
      enrichment: enrichment(),
      catalogue,
      maintenancePreference: null,
    })
    expect(plan.isEmpty).toBe(false)
    expect(plan.lines.every((l) => l.layer !== 'tree')).toBe(true)
    expect(plan.prepNote).toBe(true) // paved → prep note
  })

  it('still generates (relaxed) when the hardiness zone is unavailable', () => {
    const plan = generatePlan({
      scan: { sun_exposure: 'full', area_sqm: 30, surface: 'soil', space_type: 'back_garden' },
      enrichment: enrichment({ hardiness_zone: null, zone_status: 'unavailable' }),
      catalogue,
      maintenancePreference: 'low',
    })
    expect(plan.zoneUnconfirmed).toBe(true)
    expect(plan.isEmpty).toBe(false)
  })

  it('is deterministic against the real catalogue', () => {
    const input: GeneratePlanInput = {
      scan: { sun_exposure: 'partial', area_sqm: 60, surface: 'soil', space_type: 'front_garden' },
      enrichment: enrichment({ soil_type: 'clay' }),
      catalogue,
      maintenancePreference: 'medium',
    }
    expect(JSON.stringify(generatePlan(input))).toBe(JSON.stringify(generatePlan(input)))
  })
})
