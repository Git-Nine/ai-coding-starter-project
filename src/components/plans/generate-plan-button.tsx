'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PLANTS_TABLE, type Plant, type MaintenanceLevel } from '@/lib/plants'
import { PLANS_TABLE, PLAN_PLANTS_TABLE } from '@/lib/plans'
import { generatePlan } from '@/lib/plan-engine'
import type { Scan, ScanEnrichment } from '@/lib/scans'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Runs the rule engine in the browser, overwrites the scan's plan (one per scan),
 * and opens the read-only plan view. Reused for both "Generate plan" (scan detail)
 * and "Regenerate plan" (plan view). RLS enforces ownership on every write — the
 * same client-write pattern as scans/plants.
 */
export function GeneratePlanButton({
  scan,
  enrichment,
  userId,
  label = 'Generate plan',
  variant = 'default',
  className,
}: {
  scan: Scan
  enrichment: ScanEnrichment | null
  userId: string
  label?: string
  variant?: 'default' | 'secondary'
  className?: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleGenerate() {
    setBusy(true)
    try {
      const [{ data: catalogue, error: catErr }, { data: profile }] = await Promise.all([
        supabase.from(PLANTS_TABLE).select('*'),
        supabase
          .from('users')
          .select('maintenance_preference')
          .eq('id', userId)
          .maybeSingle<{ maintenance_preference: MaintenanceLevel | null }>(),
      ])
      if (catErr) throw catErr

      const plan = generatePlan({
        scan,
        enrichment,
        catalogue: (catalogue ?? []) as Plant[],
        maintenancePreference: profile?.maintenance_preference ?? null,
      })

      const planId = crypto.randomUUID()

      // One plan per scan: replace any existing plan (cascade clears its lines).
      const { error: delErr } = await supabase.from(PLANS_TABLE).delete().eq('scan_id', scan.id)
      if (delErr) throw delErr

      const { error: planErr } = await supabase.from(PLANS_TABLE).insert({
        id: planId,
        scan_id: scan.id,
        user_id: userId,
        snapshot_sun: plan.snapshot.sun,
        snapshot_area_sqm: plan.snapshot.area_sqm,
        snapshot_surface: plan.snapshot.surface,
        snapshot_space_type: plan.snapshot.space_type,
        snapshot_soil: plan.snapshot.soil,
        snapshot_zone: plan.snapshot.zone,
        snapshot_maintenance: plan.snapshot.maintenance,
        zone_unconfirmed: plan.zoneUnconfirmed,
        extra_match_count: plan.extraMatchCount,
      })
      if (planErr) throw planErr

      if (plan.lines.length > 0) {
        const rows = plan.lines.map((l) => ({
          plan_id: planId,
          plant_id: l.plant.id,
          quantity: l.quantity,
          sort_order: l.sortOrder,
          soil_flag: l.soilFlag,
        }))
        const { error: linesErr } = await supabase.from(PLAN_PLANTS_TABLE).insert(rows)
        if (linesErr) throw linesErr
      }

      router.push(`/scans/${scan.id}/plan`)
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not generate the plan. Please try again.',
      )
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={cn('w-full', className)}
      disabled={busy}
      onClick={handleGenerate}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Sparkles className="h-4 w-4" /> {label}
        </>
      )}
    </Button>
  )
}
