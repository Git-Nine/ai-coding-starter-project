import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/brand/logo'
import { PlanView } from '@/components/plans/plan-view'
import { GeneratePlanButton } from '@/components/plans/generate-plan-button'
import { scanTitle, type Scan, type ScanEnrichment } from '@/lib/scans'
import { PLANS_TABLE, PLAN_PLANTS_TABLE, type Plan, type PlanPlantWithPlant } from '@/lib/plans'

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/login?returnTo=/scans/${id}/plan`)

  // RLS guarantees a user only reads their own scan.
  const { data: scan } = await supabase.from('scans').select('*').eq('id', id).maybeSingle<Scan>()
  if (!scan) notFound()

  // No plan yet (or tables not migrated) → send the user to the scan to generate one.
  const { data: plan } = await supabase
    .from(PLANS_TABLE)
    .select('*')
    .eq('scan_id', id)
    .maybeSingle<Plan>()
  if (!plan) redirect(`/scans/${id}`)

  const [linesResult, enrichmentResult] = await Promise.all([
    supabase
      .from(PLAN_PLANTS_TABLE)
      .select('*, plants(*)')
      .eq('plan_id', plan.id)
      .order('sort_order'),
    supabase.from('scan_enrichment').select('*').eq('scan_id', id).maybeSingle<ScanEnrichment>(),
  ])

  const lines = (linesResult.data ?? []) as PlanPlantWithPlant[]
  const enrichment = enrichmentResult.data ?? null

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
        <Link
          href={`/scans/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Space
        </Link>
        <Logo />
        <span className="w-12" aria-hidden />
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-16 pt-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-label">{scanTitle(scan)}</p>
        <h1 className="mt-1 text-3xl">Your planting plan</h1>

        <div className="mt-6">
          <PlanView plan={plan} lines={lines} scanId={id} />
        </div>

        <div className="mt-8">
          <GeneratePlanButton
            scan={scan}
            enrichment={enrichment}
            userId={user.id}
            label="Regenerate plan"
            variant="secondary"
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Regenerating rebuilds the plan from your current conditions.
          </p>
        </div>
      </main>
    </div>
  )
}
