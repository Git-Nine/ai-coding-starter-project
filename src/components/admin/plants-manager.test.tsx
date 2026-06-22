import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { PlantsManager } from './plants-manager'
import type { Plant } from '@/lib/plants'

/**
 * PROJ-5 — list/search/filter/empty-state acceptance criteria at the component
 * level (no auth or DB needed). The delete-dialog interaction is covered by the
 * RLS harness + manual testing; here we only assert the manager's own behaviour,
 * including the "can't delete the last plant" guard.
 */

function plant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: crypto.randomUUID(),
    common_name: 'Echter Lavendel',
    latin_name: 'Lavandula angustifolia',
    sun_tolerance: ['full'],
    soil_compatibility: ['sand', 'loam'],
    min_hardiness_zone: 6,
    mature_height_cm: 60,
    mature_spread_cm: 60,
    maintenance_level: 'low',
    plant_type: 'shrub',
    native: false,
    image_url: null,
    care_notes: null,
    created_at: '2026-06-20T00:00:00Z',
    updated_at: null,
    ...overrides,
  }
}

const lavender = plant({ common_name: 'Echter Lavendel', latin_name: 'Lavandula angustifolia' })
const salvia = plant({
  common_name: 'Steppen-Salbei',
  latin_name: 'Salvia nemorosa',
  maintenance_level: 'medium',
  native: true,
  sun_tolerance: ['full', 'partial'],
})

describe('PlantsManager', () => {
  it('shows an inviting empty state when the catalogue is empty', () => {
    render(<PlantsManager plants={[]} />)
    expect(screen.getByText('No plants yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add the first plant/i })).toBeInTheDocument()
  })

  it('lists every plant with its common and Latin name, maintenance and native flag', () => {
    render(<PlantsManager plants={[lavender, salvia]} />)
    expect(screen.getByText('Echter Lavendel')).toBeInTheDocument()
    expect(screen.getByText('Lavandula angustifolia')).toBeInTheDocument()
    expect(screen.getByText('Steppen-Salbei')).toBeInTheDocument()
    // Native badge shows on the native plant's row, not the non-native one.
    const salviaRow = screen.getByText('Steppen-Salbei').closest('tr')!
    expect(within(salviaRow).getByText('Native')).toBeInTheDocument()
    const lavenderRow = screen.getByText('Echter Lavendel').closest('tr')!
    expect(within(lavenderRow).queryByText('Native')).not.toBeInTheDocument()
  })

  it('filters the list by a common- or Latin-name search', () => {
    render(<PlantsManager plants={[lavender, salvia]} />)
    fireEvent.change(screen.getByLabelText(/search plants by name/i), { target: { value: 'salbei' } })
    expect(screen.getByText('Steppen-Salbei')).toBeInTheDocument()
    expect(screen.queryByText('Echter Lavendel')).not.toBeInTheDocument()

    // Latin-name match works too.
    fireEvent.change(screen.getByLabelText(/search plants by name/i), { target: { value: 'lavandula' } })
    expect(screen.getByText('Echter Lavendel')).toBeInTheDocument()
    expect(screen.queryByText('Steppen-Salbei')).not.toBeInTheDocument()
  })

  it('shows a "no matches" row when the search matches nothing', () => {
    render(<PlantsManager plants={[lavender, salvia]} />)
    fireEvent.change(screen.getByLabelText(/search plants by name/i), { target: { value: 'zzz-nothing' } })
    expect(screen.getByText(/no plants match/i)).toBeInTheDocument()
  })

  it('disables Delete when only one plant remains (no replacement can be chosen)', () => {
    render(<PlantsManager plants={[lavender]} />)
    expect(screen.getByRole('button', { name: /delete echter lavendel/i })).toBeDisabled()
  })

  it('enables Delete when more than one plant exists', () => {
    render(<PlantsManager plants={[lavender, salvia]} />)
    const row = screen.getByText('Echter Lavendel').closest('tr')!
    expect(within(row).getByRole('button', { name: /delete/i })).toBeEnabled()
  })
})
