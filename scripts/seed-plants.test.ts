import { describe, it, expect } from 'vitest'
import { PLANTS } from './seed-plants.mjs'
import { plantSchema } from '@/lib/plants'

/**
 * The seed data must satisfy the SAME contract the admin form enforces (and, by
 * extension, the DB check constraints) — otherwise `npm run seed:plants` would
 * insert rows the UI considers invalid, or the insert would fail at the DB.
 * This guards the seed without needing a live database.
 */
describe('seed-plants data', () => {
  it('loads a non-empty catalogue', () => {
    expect(Array.isArray(PLANTS)).toBe(true)
    expect(PLANTS.length).toBeGreaterThan(0)
  })

  it('every seed plant passes the shared plant schema', () => {
    for (const plant of PLANTS) {
      const result = plantSchema.safeParse(plant)
      if (!result.success) {
        throw new Error(
          `Invalid seed plant "${plant.latin_name}": ${JSON.stringify(result.error.flatten().fieldErrors)}`,
        )
      }
      expect(result.success).toBe(true)
    }
  })

  it('has no duplicate Latin names (the unique/idempotency key)', () => {
    const names = PLANTS.map((p: { latin_name: string }) => p.latin_name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('includes at least one native and one shade-tolerant plant (rule-engine coverage)', () => {
    expect(PLANTS.some((p: { native: boolean }) => p.native)).toBe(true)
    expect(
      PLANTS.some((p: { sun_tolerance: string[] }) => p.sun_tolerance.includes('shade')),
    ).toBe(true)
  })

  it('covers more than one structural layer (PROJ-6 layered plans)', () => {
    const types = new Set(PLANTS.map((p: { plant_type: string }) => p.plant_type))
    expect(types.size).toBeGreaterThan(1)
  })
})
