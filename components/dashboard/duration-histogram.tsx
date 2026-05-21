'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DURATION_BUCKETS } from '@/lib/filters'
import { useFiltersStore } from '@/lib/stores/filters-store'
import type { CallLogEnriched, DurationBucketId } from '@/lib/types'

interface Props {
  calls: CallLogEnriched[]
  isLoading?: boolean
}

interface BucketStat {
  id: DurationBucketId
  label: string
  count: number
  rdv: number
  rdvRate: number
  answered: number
  topQualif: string | null
}

export function DurationHistogram({ calls, isLoading }: Props) {
  const toggleArray = useFiltersStore((s) => s.toggleArray)
  const selectedDurations = useFiltersStore((s) => s.filters.durations)

  const buckets: BucketStat[] = useMemo(() => {
    return DURATION_BUCKETS.map((b) => {
      const inBucket = calls.filter((c) => b.test(c.duration))
      const rdv = inBucket.filter((c) => c.lead?.qualification === 'RDV MEDECIN').length
      const answered = inBucket.filter((c) => c.answered).length
      // Find top qualification in this bucket
      const counts = new Map<string, number>()
      for (const c of inBucket) {
        const q = c.lead?.qualification ?? 'UNKNOWN'
        counts.set(q, (counts.get(q) ?? 0) + 1)
      }
      const topQualif = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      return {
        id: b.id,
        label: b.label,
        count: inBucket.length,
        rdv,
        rdvRate: inBucket.length > 0 ? (rdv / inBucket.length) * 100 : 0,
        answered,
        topQualif,
      }
    })
  }, [calls])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Duration distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    )
  }

  const max = Math.max(...buckets.map((b) => b.count), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Duration distribution</CardTitle>
        <CardDescription>Click a bucket to filter the dashboard</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {buckets.map((b) => {
            const selected = selectedDurations.includes(b.id)
            return (
              <button
                key={b.id}
                onClick={() => toggleArray('durations', b.id)}
                className={`flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors ${
                  selected ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/50'
                }`}
              >
                <span className="text-xs font-mono w-20 text-muted-foreground">{b.label}</span>
                <div className="flex-1">
                  <div className="relative h-5 overflow-hidden rounded bg-muted">
                    <div
                      className="absolute left-0 top-0 h-full bg-blue-500/40"
                      style={{ width: `${(b.count / max) * 100}%` }}
                    />
                    <div
                      className="absolute left-0 top-0 h-full bg-emerald-500/70"
                      style={{ width: `${(b.rdv / max) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono w-44 justify-end">
                  <span>{b.count.toLocaleString()}</span>
                  <span className="text-emerald-500 font-semibold">
                    {b.rdvRate.toFixed(1)}% RDV
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
