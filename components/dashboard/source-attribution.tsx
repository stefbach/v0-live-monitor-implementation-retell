'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFiltersStore } from '@/lib/stores/filters-store'
import type { SourceBreakdown } from '@/lib/types'

interface Props {
  data: SourceBreakdown[]
  isLoading?: boolean
}

export function SourceAttribution({ data, isLoading }: Props) {
  const toggle = useFiltersStore((s) => s.toggleArray)
  const selected = useFiltersStore((s) => s.filters.sources)
  const selSet = new Set(selected)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead source attribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Lead source attribution</CardTitle>
        <CardDescription>Volume + RDV conversion · click to filter</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.slice(0, 8).map((s) => {
            const isSel = selSet.has(s.source)
            return (
              <button
                key={s.source}
                onClick={() => toggle('sources', s.source)}
                className={`w-full text-left space-y-1 rounded-md p-2 transition-colors ${
                  isSel ? 'bg-muted' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{s.source}</span>
                  <span className="font-mono text-muted-foreground text-xs">
                    {s.total.toLocaleString()} leads · {s.rdv.toLocaleString()} RDV ·{' '}
                    <span className="text-emerald-500 font-semibold">
                      {s.conversionRate.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="relative h-5 overflow-hidden rounded-md bg-muted">
                  <div
                    className="absolute left-0 top-0 h-full bg-blue-500/30"
                    style={{ width: `${(s.total / maxTotal) * 100}%` }}
                  />
                  <div
                    className="absolute left-0 top-0 h-full bg-emerald-500/70"
                    style={{ width: `${(s.rdv / maxTotal) * 100}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
