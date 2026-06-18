import { describe, it, expect } from 'vitest'
import {
  scanSchema,
  validatePhotoFile,
  scanTitle,
  scanSummary,
  scanPhotoPath,
  PHOTO_MAX_BYTES,
} from './scans'

const validInput = {
  name: 'Back garden',
  postcode: '10115',
  sun_exposure: 'full',
  surface: 'gravel',
  space_type: 'back_garden',
  area_sqm: 20,
}

function fakeFile(type: string, bytes: number, name = 'photo.jpg'): File {
  const file = new File([new Uint8Array(1)], name, { type })
  // Force the reported size without allocating the full buffer.
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}

describe('scanSchema', () => {
  it('accepts a complete, valid scan', () => {
    expect(scanSchema.safeParse(validInput).success).toBe(true)
  })

  it('rejects a non-5-digit postcode', () => {
    expect(scanSchema.safeParse({ ...validInput, postcode: '1011' }).success).toBe(false)
    expect(scanSchema.safeParse({ ...validInput, postcode: 'ABCDE' }).success).toBe(false)
  })

  it('rejects an unselected choice field', () => {
    expect(scanSchema.safeParse({ ...validInput, sun_exposure: '' }).success).toBe(false)
  })

  it('rejects area outside 1–5000 or non-integer', () => {
    expect(scanSchema.safeParse({ ...validInput, area_sqm: 0 }).success).toBe(false)
    expect(scanSchema.safeParse({ ...validInput, area_sqm: 5001 }).success).toBe(false)
    expect(scanSchema.safeParse({ ...validInput, area_sqm: 20.5 }).success).toBe(false)
    expect(scanSchema.safeParse({ ...validInput, area_sqm: NaN }).success).toBe(false)
  })

  it('rejects a name over 60 characters', () => {
    expect(scanSchema.safeParse({ ...validInput, name: 'x'.repeat(61) }).success).toBe(false)
  })

  it('allows an empty name (optional)', () => {
    expect(scanSchema.safeParse({ ...validInput, name: '' }).success).toBe(true)
  })
})

describe('validatePhotoFile', () => {
  it('accepts a JPEG under the size cap', () => {
    expect(validatePhotoFile(fakeFile('image/jpeg', 1_000_000))).toBeNull()
  })

  it('accepts a HEIC file even when the browser reports no type', () => {
    expect(validatePhotoFile(fakeFile('', 1_000_000, 'IMG_0001.HEIC'))).toBeNull()
  })

  it('rejects a disallowed type', () => {
    expect(validatePhotoFile(fakeFile('application/pdf', 1000, 'doc.pdf'))).toMatch(/JPEG/)
  })

  it('rejects a file over 10 MB', () => {
    expect(validatePhotoFile(fakeFile('image/jpeg', PHOTO_MAX_BYTES + 1))).toMatch(/10 MB/)
  })
})

describe('display helpers', () => {
  it('uses the name as the title, falling back to the space type', () => {
    expect(scanTitle({ name: 'Patio', space_type: 'balcony' })).toBe('Patio')
    expect(scanTitle({ name: null, space_type: 'balcony' })).toBe('Balcony')
    expect(scanTitle({ name: '   ', space_type: 'front_garden' })).toBe('Front garden')
  })

  it('formats the one-line summary', () => {
    expect(scanSummary({ sun_exposure: 'full', surface: 'gravel', area_sqm: 20 })).toBe(
      'Full sun · Gravel · 20 m²',
    )
  })

  it('builds the fixed per-scan storage path', () => {
    expect(scanPhotoPath('user-1', 'scan-9')).toBe('user-1/scans/scan-9/photo')
  })
})
