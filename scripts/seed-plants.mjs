// PROJ-5: one-time seed of German-relevant plants into public.plants.
//
//   npm run seed:plants
//
// Idempotent: upserts on the unique latin_name with ignoreDuplicates → ON CONFLICT
// DO NOTHING. Re-running never creates duplicates and never overwrites a row an
// admin has since edited (spec edge case). Uses the service-role key, which bypasses
// RLS — so it must run server-side only, never in the browser.
//
// Env (loaded via `node --env-file=.env.local`): NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.
//
// The data is a small cleaned reference set, NOT a live FloraWeb/BfN sync (a v1
// non-goal). Curators extend/correct it through /admin/plants afterwards.

import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

/**
 * Initial catalogue. Each row carries every required attribute so the rule engine
 * (PROJ-6) can match it from day one. Vocabularies mirror the app contract
 * (src/lib/plants.ts): sun ∈ full/partial/shade, soil ∈ sand/loam/clay/silt/peat,
 * maintenance ∈ low/medium/high, hardiness zone = whole number, sizes in cm.
 */
export const PLANTS = [
  {
    common_name: 'Steppen-Salbei',
    latin_name: 'Salvia nemorosa',
    sun_tolerance: ['full'],
    soil_compatibility: ['sand', 'loam', 'clay'],
    min_hardiness_zone: 5,
    mature_height_cm: 50,
    mature_spread_cm: 40,
    maintenance_level: 'low',
    native: true,
    care_notes: 'Shear back after the first flush for a second bloom. Loves dry, sunny spots.',
  },
  {
    common_name: 'Gewöhnliche Schafgarbe',
    latin_name: 'Achillea millefolium',
    sun_tolerance: ['full', 'partial'],
    soil_compatibility: ['sand', 'loam', 'clay'],
    min_hardiness_zone: 3,
    mature_height_cm: 60,
    mature_spread_cm: 45,
    maintenance_level: 'low',
    native: true,
    care_notes: 'Tough, drought-tolerant pollinator magnet. Thrives on poor soils.',
  },
  {
    common_name: 'Blutroter Storchschnabel',
    latin_name: 'Geranium sanguineum',
    sun_tolerance: ['full', 'partial'],
    soil_compatibility: ['sand', 'loam'],
    min_hardiness_zone: 4,
    mature_height_cm: 30,
    mature_spread_cm: 45,
    maintenance_level: 'low',
    native: true,
    care_notes: 'Reliable weed-suppressing groundcover with long magenta flowering.',
  },
  {
    common_name: 'Hohe Fetthenne',
    latin_name: 'Hylotelephium telephium',
    sun_tolerance: ['full'],
    soil_compatibility: ['sand', 'loam'],
    min_hardiness_zone: 4,
    mature_height_cm: 50,
    mature_spread_cm: 45,
    maintenance_level: 'low',
    native: true,
    care_notes: 'Late-season nectar source; leave seed heads for winter structure.',
  },
  {
    common_name: 'Roter Fingerhut',
    latin_name: 'Digitalis purpurea',
    sun_tolerance: ['partial', 'shade'],
    soil_compatibility: ['loam', 'sand'],
    min_hardiness_zone: 4,
    mature_height_cm: 120,
    mature_spread_cm: 45,
    maintenance_level: 'medium',
    native: true,
    care_notes: 'Biennial; self-seeds readily. All parts toxic if eaten.',
  },
  {
    common_name: 'Echter Lavendel',
    latin_name: 'Lavandula angustifolia',
    sun_tolerance: ['full'],
    soil_compatibility: ['sand', 'loam'],
    min_hardiness_zone: 6,
    mature_height_cm: 60,
    mature_spread_cm: 60,
    maintenance_level: 'low',
    native: false,
    care_notes: 'Needs sharp drainage. Prune lightly after flowering, never into old wood.',
  },
  {
    common_name: 'Purpur-Sonnenhut',
    latin_name: 'Echinacea purpurea',
    sun_tolerance: ['full', 'partial'],
    soil_compatibility: ['loam', 'sand'],
    min_hardiness_zone: 5,
    mature_height_cm: 90,
    mature_spread_cm: 45,
    maintenance_level: 'low',
    native: false,
    care_notes: 'Long-flowering prairie perennial; seed heads feed finches in winter.',
  },
  {
    common_name: 'Katzenminze',
    latin_name: 'Nepeta x faassenii',
    sun_tolerance: ['full', 'partial'],
    soil_compatibility: ['sand', 'loam'],
    min_hardiness_zone: 4,
    mature_height_cm: 45,
    mature_spread_cm: 45,
    maintenance_level: 'low',
    native: false,
    care_notes: 'Drought-tolerant, very long bloom; shear mid-summer to refresh.',
  },
  {
    common_name: 'Garten-Sonnenhut',
    latin_name: 'Rudbeckia fulgida',
    sun_tolerance: ['full', 'partial'],
    soil_compatibility: ['loam', 'clay'],
    min_hardiness_zone: 4,
    mature_height_cm: 60,
    mature_spread_cm: 45,
    maintenance_level: 'medium',
    native: false,
    care_notes: 'Golden late-summer daisies; tolerates heavier soils than most.',
  },
  {
    common_name: 'Blaublatt-Funkie',
    latin_name: 'Hosta sieboldiana',
    sun_tolerance: ['partial', 'shade'],
    soil_compatibility: ['loam', 'clay'],
    min_hardiness_zone: 3,
    mature_height_cm: 60,
    mature_spread_cm: 90,
    maintenance_level: 'medium',
    native: false,
    care_notes: 'Bold shade foliage; watch for slugs on fresh spring growth.',
  },
  {
    common_name: 'Christrose',
    latin_name: 'Helleborus niger',
    sun_tolerance: ['partial', 'shade'],
    soil_compatibility: ['loam', 'clay'],
    min_hardiness_zone: 4,
    mature_height_cm: 30,
    mature_spread_cm: 30,
    maintenance_level: 'medium',
    native: false,
    care_notes: 'Winter-flowering; prefers moist, humus-rich soil in dappled shade.',
  },
  {
    common_name: 'Garten-Reitgras',
    latin_name: 'Calamagrostis x acutiflora',
    sun_tolerance: ['full', 'partial'],
    soil_compatibility: ['sand', 'loam', 'clay'],
    min_hardiness_zone: 5,
    mature_height_cm: 150,
    mature_spread_cm: 60,
    maintenance_level: 'low',
    native: false,
    care_notes: 'Upright structural grass; cut back to the base in late winter.',
  },
  {
    common_name: 'Herbst-Anemone',
    latin_name: 'Anemone hupehensis',
    sun_tolerance: ['partial', 'shade'],
    soil_compatibility: ['loam'],
    min_hardiness_zone: 5,
    mature_height_cm: 90,
    mature_spread_cm: 45,
    maintenance_level: 'medium',
    native: false,
    care_notes: 'Elegant autumn flowers; spreads steadily once established.',
  },
  {
    common_name: 'Patagonisches Eisenkraut',
    latin_name: 'Verbena bonariensis',
    sun_tolerance: ['full'],
    soil_compatibility: ['loam', 'sand'],
    min_hardiness_zone: 7,
    mature_height_cm: 120,
    mature_spread_cm: 45,
    maintenance_level: 'medium',
    native: false,
    care_notes: 'See-through airy stems; marginally hardy — mulch the crown in winter.',
  },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error(
      'Missing env. This script needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
        'Run it with:  node --env-file=.env.local scripts/seed-plants.mjs  (or `npm run seed:plants`).',
    )
    process.exit(1)
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`Seeding ${PLANTS.length} plants (insert-or-ignore on latin_name)…`)

  // ignoreDuplicates → ON CONFLICT DO NOTHING: idempotent, never clobbers admin edits.
  const { data, error } = await supabase
    .from('plants')
    .upsert(PLANTS, { onConflict: 'latin_name', ignoreDuplicates: true })
    .select('latin_name')

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }

  const inserted = data?.length ?? 0
  const skipped = PLANTS.length - inserted
  console.log(`Done. Inserted ${inserted} new, skipped ${skipped} already present.`)
}

// Only run when invoked directly (so tests can import PLANTS without seeding).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
