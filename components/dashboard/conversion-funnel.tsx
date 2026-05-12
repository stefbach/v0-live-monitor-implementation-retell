'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ConversionFunnel as Funnel } from '@/lib/types'

interface ConversionFunnelProps {
  funnel: Funnel | null
  isLoading?: boolean
}

export function ConversionFunnel({ funnel, isLoading }: ConversionFunnelProps) {
  if (isLoading || !funnel) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conversion funnel</CardTitle>
          <CardDescription>Lead → Contacted → Interested → RDV</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const max = funnel.leads || 1
  const steps = [
    {
      label: 'Total leads',
      value: funnel.leads,
      pct: 100,
      color: 'bg-blue-500/80',
      sub: '',
    },
    {
      label: 'Contacted',
      value: funnel.contacted,
      pct: (funnel.contacted / max) * 100,
      color: 'bg-violet-500/80',
      sub: `${funnel.contactRate.toFixed(1)}% of leads`,
    },
    {
      label: 'Interested',
      value: funnel.interested,
      pct: (funnel.interested / max) * 100,
      color: 'bg-amber-500/80',
      sub: `${funnel.interestRate.toFixed(1)}% of contacted`,
    },
    {
      label: 'RDV booked',
      value: funnel.rdvBooked,
      pct: (funnel.rdvBooked / max) * 100,
      color: 'bg-emerald-500/80',
      sub: `${funnel.bookingRate.toFixed(1)}% of contacted`,
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Conversion funnel</CardTitle>
        <CardDescription>Where leads drop off</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((s) => (
          <div key={s.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="font-mono text-muted-foreground">
                {s.value.toLocaleString()}{' '}
                <span className="text-xs">({s.pct.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="h-7 w-full overflow-hidden rounded-md bg-muted">
              <div
                className={`h-full ${s.color} transition-all`}
                style={{ width: `${Math.max(s.pct, 1)}%` }}
              />
            </div>
            {s.sub && <p className="text-[11px] text-muted-foreground">{s.sub}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
