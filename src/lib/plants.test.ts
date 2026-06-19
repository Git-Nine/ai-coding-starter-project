import { describe, it, expect } from 'vitest'
import {
  plantSchema,
  soilLabel,
  maintenanceLabel,
  sunToleranceSummary,
  SOIL_OPTIONS,
  ZONE_OPTIONS,
  ZONE_MIN,
  ZONE_MAX,
} from './plants'

/**
 * PROJ-5 — the shared plant contract. plantSchema is the single validation gate
 * the admin form runs (and mirrors the DB CHECK constraints), so these cover the
 * "validation error names each offending field / nothing saved" acceptance
 * criteria at the logic layer.
 */

const valid = {
  common_name: 'Echter Lavendel',
  latin_name: 'Lavandula angustifolia',
  sun_tolerance: ['full'],
  soil_compatibility: ['sand', 'loam'],
  min_hardiness_zone: 6,
  mature_height_cm: 60,
  mature_spread_cm: 60,
  maintenance_level: 'low',
  native: false,
  image_url: '',
  care_notes: '',
}

describe('plantSchema — happy path', () => {
  it('accepts a fully valid plant', () => {
    expect(plantSchema.safeParse(valid).success).toBe(true)
  })

  it('treats image_url and care_notes as optional (empty + undefined both pass)', () => {
    expect(plantSchema.safeParse({ ...valid, image_url: '', care_notes: '' }).success).toBe(true)
    const { image_url: _i, care_notes: _c, ...withoutOptionals } = valid
    expect(plantSchema.safeParse(withoutOptionals).success).toBe(true)
  })

  it('accepts a well-formed http(s) image URL', () => {
    expect(plantSchema.safeParse({ ...valid, image_url: 'https://example.com/plant.jpg' }).success).toBe(true)
  })

  it('accepts multi-value sun and soil sets', () => {
    const r = plantSchema.safeParse({
      ...valid,
      sun_tolerance: ['full', 'partial', 'shade'],
      soil_compatibility: ['sand', 'loam', 'clay', 'silt', 'peat'],
    })
    expect(r.success).toBe(true)
  })
})

describe('plantSchema — required field validation', () => {
  it('rejects an empty common name', () => {
    const r = plantSchema.safeParse({ ...valid, common_name: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.common_name?.[0]).toBeTruthy()
  })

  it('rejects an empty Latin name', () => {
    const r = plantSchema.safeParse({ ...valid, latin_name: '   ' })
    expect(r.success).toBe(false)
  })

  it('rejects an empty sun_tolerance set', () => {
    const r = plantSchema.safeParse({ ...valid, sun_tolerance: [] })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.sun_tolerance?.[0]).toMatch(/at least one/i)
  })

  it('rejects an unknown sun value', () => {
    expect(plantSchema.safeParse({ ...valid, sun_tolerance: ['blazing'] }).success).toBe(false)
  })

  it('rejects an empty soil_compatibility set', () => {
    expect(plantSchema.safeParse({ ...valid, soil_compatibility: [] }).success).toBe(false)
  })

  it('rejects an unknown soil value', () => {
    expect(plantSchema.safeParse({ ...valid, soil_compatibility: ['gravel'] }).success).toBe(false)
  })

  it('rejects an invalid maintenance level', () => {
    expect(plantSchema.safeParse({ ...valid, maintenance_level: 'extreme' }).success).toBe(false)
  })
})

describe('plantSchema — numeric bounds', () => {
  it(`rejects a hardiness zone below ${ZONE_MIN} or above ${ZONE_MAX}`, () => {
    expect(plantSchema.safeParse({ ...valid, min_hardiness_zone: ZONE_MIN - 1 }).success).toBe(false)
    expect(plantSchema.safeParse({ ...valid, min_hardiness_zone: ZONE_MAX + 1 }).success).toBe(false)
  })

  it('rejects a non-integer hardiness zone', () => {
    expect(plantSchema.safeParse({ ...valid, min_hardiness_zone: 6.5 }).success).toBe(false)
  })

  it('rejects NaN dimensions (empty numeric input)', () => {
    expect(plantSchema.safeParse({ ...valid, mature_height_cm: NaN }).success).toBe(false)
  })

  it('rejects out-of-range height and spread', () => {
    expect(plantSchema.safeParse({ ...valid, mature_height_cm: 0 }).success).toBe(false)
    expect(plantSchema.safeParse({ ...valid, mature_height_cm: 3001 }).success).toBe(false)
    expect(plantSchema.safeParse({ ...valid, mature_spread_cm: 0 }).success).toBe(false)
    expect(plantSchema.safeParse({ ...valid, mature_spread_cm: 3001 }).success).toBe(false)
  })
})

describe('plantSchema — image URL validation', () => {
  it('rejects a malformed URL', () => {
    const r = plantSchema.safeParse({ ...valid, image_url: 'not a url' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.image_url?.[0]).toMatch(/valid URL/i)
  })

  // BUG-2 (Low): z.string().url() accepts non-http(s) schemes like javascript:/data:.
  // Documented here so the behaviour is visible; harmless in PROJ-5 (image_url is
  // never rendered) but PROJ-6/7/8 must render with an http(s) guard. See QA findings.
  it('DOCUMENTS that javascript: scheme currently passes URL validation', () => {
    const r = plantSchema.safeParse({ ...valid, image_url: 'javascript:alert(1)' })
    expect(r.success).toBe(true)
  })
})

describe('plantSchema — care notes length', () => {
  it('rejects care notes over the maximum length', () => {
    expect(plantSchema.safeParse({ ...valid, care_notes: 'x'.repeat(2001) }).success).toBe(false)
  })
})

describe('label + summary helpers', () => {
  it('maps every soil value to a label', () => {
    for (const o of SOIL_OPTIONS) expect(soilLabel(o.value)).toBe(o.label)
  })

  it('maps maintenance values to labels', () => {
    expect(maintenanceLabel('low')).toBe('Low')
    expect(maintenanceLabel('high')).toBe('High')
  })

  it('joins a sun tolerance set into a readable summary', () => {
    expect(sunToleranceSummary(['full', 'partial'])).toBe('Full sun · Partial sun')
  })

  it('exposes the full whole-number zone range as options', () => {
    expect(ZONE_OPTIONS[0]).toBe(ZONE_MIN)
    expect(ZONE_OPTIONS[ZONE_OPTIONS.length - 1]).toBe(ZONE_MAX)
  })
})
