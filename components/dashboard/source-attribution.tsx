'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { SourceBreakdown } from '@/lib/types'

interface Props {
  data: SourceBreakdown[]
  isLoading?: boolean
}

export function SourceAttribution({ data, isLoading }: Props) {
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
        <CardDescription>Volume vs. conversion rate to RDV</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.slice(0, 8).map((s) => (
            <div key={s.source} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate">{s.source}</span>
                <span className="font-mono text-muted-foreground">
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
