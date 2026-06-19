'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Leaf, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import {
  SUN_OPTIONS,
  MAINTENANCE_OPTIONS,
  maintenanceLabel,
  sunToleranceSummary,
  type Plant,
} from '@/lib/plants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeletePlantDialog } from './delete-plant-dialog'

const ALL = 'all'

export function PlantsManager({ plants }: { plants: Plant[] }) {
  const [query, setQuery] = useState('')
  const [maintenance, setMaintenance] = useState<string>(ALL)
  const [sun, setSun] = useState<string>(ALL)
  const [toDelete, setToDelete] = useState<Plant | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return plants.filter((p) => {
      const matchesQuery =
        !q ||
        p.common_name.toLowerCase().includes(q) ||
        p.latin_name.toLowerCase().includes(q)
      const matchesMaintenance = maintenance === ALL || p.maintenance_level === maintenance
      const matchesSun = sun === ALL || p.sun_tolerance.includes(sun as Plant['sun_tolerance'][number])
      return matchesQuery && matchesMaintenance && matchesSun
    })
  }, [plants, query, maintenance, sun])

  // Empty catalogue → invite the first plant (distinct from "no filter matches").
  if (plants.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
        <Leaf className="h-8 w-8 text-accent" />
        <div className="space-y-1">
          <p className="font-serif text-xl">No plants yet</p>
          <p className="text-sm text-muted-foreground">
            Add the first plant to start building the catalogue the planner draws from.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/plants/new"><Plus className="h-4 w-4" /> Add the first plant</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search plants by name"
          />
        </div>
        <Select value={maintenance} onValueChange={setMaintenance}>
          <SelectTrigger className="sm:w-44" aria-label="Filter by maintenance level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All maintenance</SelectItem>
            {MAINTENANCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sun} onValueChange={setSun}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by sun tolerance">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sun</SelectItem>
            {SUN_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plant</TableHead>
              <TableHead>Sun</TableHead>
              <TableHead>Maintenance</TableHead>
              <TableHead>Native</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No plants match your search or filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.common_name}</div>
                    <div className="text-xs italic text-muted-foreground">{p.latin_name}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sunToleranceSummary(p.sun_tolerance)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{maintenanceLabel(p.maintenance_level)}</Badge>
                  </TableCell>
                  <TableCell>
                    {p.native ? (
                      <Badge>Native</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" aria-label={`Edit ${p.common_name}`}>
                        <Link href={`/admin/plants/${p.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${p.common_name}`}
                        title={plants.length <= 1 ? 'Need another plant to use as a replacement first' : undefined}
                        disabled={plants.length <= 1}
                        onClick={() => setToDelete(p)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {toDelete && (
        <DeletePlantDialog
          plant={toDelete}
          otherPlants={plants.filter((p) => p.id !== toDelete.id)}
          open={toDelete !== null}
          onOpenChange={(open) => { if (!open) setToDelete(null) }}
        />
      )}
    </div>
  )
}
