import Link from 'next/link'
import { Leaf, Sprout, TriangleAlert, Shovel } from 'lucide-react'
import {
  LAYER_DISPLAY_ORDER,
  safeImageUrl,
  plantTypePlural,
  soilLabel,
  maintenanceLabel,
} from '@/lib/plants'
import { sunLabel } from '@/lib/scans'
import { needsPrep, type Plan, type PlanPlantWithPlant } from '@/lib/plans'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * Read-only plan view (PROJ-6). Renders the generated plan grouped by structural
 * layer, with the conditions it was based on, honest notes, and per-plant reasons.
 * Interactive editing (see-more / select / accept) is PROJ-7.
 */
export function PlanView({
  plan,
  lines,
  scanId,
}: {
  plan: Plan
  lines: PlanPlantWithPlant[]
  scanId: string
}) {
  const conditions = [
    { label: 'Sun', value: sunLabel(plan.snapshot_sun) },
    { label: 'Winter zone', value: plan.snapshot_zone != null ? `Zone ${plan.snapshot_zone}` : 'Not available' },
    { label: 'Soil', value: plan.snapshot_soil ? soilLabel(plan.snapshot_soil) : 'Not available' },
  ]

  return (
    <div className="space-y-6">
      {/* Conditions the plan was based on */}
      <Card>
        <CardContent className="p-0">
          <p className="px-5 pt-4 font-mono text-[11px] uppercase tracking-wider text-label">
            Based on your conditions
          </p>
          <div className="divide-y divide-border">
            {conditions.map((c) => (
              <div key={c.label} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <span className="text-sm font-medium">{c.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Honest notes */}
      {plan.zone_unconfirmed && (
        <div className="flex gap-3 rounded-xl border border-border bg-secondary px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            We couldn’t confirm your winter-hardiness zone, so winter survival isn’t guaranteed for
            this plan.
          </p>
        </div>
      )}
      {needsPrep(plan.snapshot_surface) && (
        <div className="flex gap-3 rounded-xl border border-border bg-secondary px-4 py-3">
          <Shovel className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            This plan assumes you’ll clear the existing surface and add soil or containers first.
          </p>
        </div>
      )}

      {/* Empty state */}
      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Leaf className="h-8 w-8 text-accent" />
          <div className="space-y-1">
            <p className="font-serif text-xl">No plants suit this space yet</p>
            <p className="text-sm text-muted-foreground">
              None of the plants in our catalogue match this space’s sun and winter conditions for
              now. Try adjusting the scan, or check back as the catalogue grows.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/scans/${scanId}`}>Back to space</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-7">
          {LAYER_DISPLAY_ORDER.map((layer) => {
            const inLayer = lines.filter((l) => l.plants?.plant_type === layer)
            if (inLayer.length === 0) return null
            return (
              <section key={layer} className="space-y-3">
                <h2 className="font-mono text-[11px] uppercase tracking-wider text-label">
                  {plantTypePlural(layer)}
                </h2>
                <div className="space-y-3">
                  {inLayer.map((line) => (
                    <PlanPlantCard key={line.id} line={line} maintenancePref={plan.snapshot_maintenance} />
                  ))}
                </div>
              </section>
            )
          })}

          {plan.extra_match_count > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {plan.extra_match_count} more {plan.extra_match_count === 1 ? 'plant' : 'plants'} also
              suit your space — you’ll be able to add them when reviewing your plan.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function PlanPlantCard({
  line,
  maintenancePref,
}: {
  line: PlanPlantWithPlant
  maintenancePref: Plan['snapshot_maintenance']
}) {
  const plant = line.plants
  if (!plant) return null
  const img = safeImageUrl(plant.image_url)
  const maintenanceMatch = maintenancePref != null && plant.maintenance_level === maintenancePref

  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={plant.common_name} className="h-full w-full object-cover" />
          ) : (
            <Sprout className="h-7 w-7 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-medium">{plant.common_name}</p>
            <span className="shrink-0 text-sm font-semibold">× {line.quantity}</span>
          </div>
          <p className="truncate text-xs italic text-muted-foreground">{plant.latin_name}</p>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {plant.native && <Badge>Native</Badge>}
            {maintenanceMatch && (
              <Badge variant="secondary">
                {maintenanceLabel(plant.maintenance_level)}-maintenance match
              </Badge>
            )}
            {line.soil_flag && (
              <Badge variant="outline" className="border-[#C2683F] text-[#C2683F]">
                May not suit your soil
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
