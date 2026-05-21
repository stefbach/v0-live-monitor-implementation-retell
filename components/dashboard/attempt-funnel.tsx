'use client'

import { useMemo } from 'react'
import { TrendingUp, Repeat } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { computeAttemptStats } from '@/lib/analytics'
import type { CallLogEnriched } from '@/lib/types'

interface Props {
  calls: CallLogEnriched[]
  isLoading?: boolean
}

export function AttemptFunnel({ calls, isLoading }: Props) {
  const stats = useMemo(() => computeAttemptStats(calls), [calls])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attempt funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  const maxLeads = Math.max(...stats.map((s) => s.leadsReached), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Repeat className="h-4 w-4 text-violet-500" />
          Attempt funnel
        </CardTitle>
        <CardDescription>How many leads make it to call #2, #3 — and does it convert?</CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 || stats[0].leadsReached === 0 ? (
          <p className="text-sm text-muted-foreground">No data for the current filters.</p>
        ) : (
          <div className="space-y-3">
            {stats.map((s) => (
              <div key={s.attempt} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Call #{s.attempt}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {s.leadsReached.toLocaleString()} leads
                    </span>
                    <span>
                      {s.answered.toLocaleString()} answered ({s.answerRate.toFixed(0)}%)
                    </span>
                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {s.rdv.toLocaleString()} RDV ({s.rdvRate.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="relative h-6 overflow-hidden rounded-md bg-muted">
                  <div
                    className="absolute left-0 top-0 h-full bg-blue-500/30"
                    style={{ width: `${(s.leadsReached / maxLeads) * 100}%` }}
                  />
                  <div
                    className="absolute left-0 top-0 h-full bg-emerald-500/70"
                    style={{ width: `${(s.rdv / maxLeads) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
