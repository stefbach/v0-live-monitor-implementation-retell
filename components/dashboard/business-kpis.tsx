'use client'

import {
  CalendarCheck,
  CalendarPlus,
  PhoneOff,
  PhoneCall,
  TrendingUp,
  Users,
  Activity,
  Repeat,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { BusinessMetrics, CallMetrics } from '@/lib/types'

interface BusinessKpisProps {
  metrics: CallMetrics | null
  business: BusinessMetrics | null
  isLoading?: boolean
}

export function BusinessKpis({ metrics, business, isLoading }: BusinessKpisProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="py-4">
            <CardContent className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const tiles = [
    {
      label: 'Appointment rate',
      value: business ? `${business.rdvRate.toFixed(1)}%` : '—',
      sub: business ? `${business.funnel.rdvBooked} RDV / ${business.funnel.contacted} contacted` : '',
      icon: TrendingUp,
      color: 'bg-emerald-500/10 text-emerald-500',
      highlight: true,
    },
    {
      label: 'RDV booked today',
      value: business ? business.rdvToday.toLocaleString() : '—',
      sub: business ? `${business.rdvThisWeek} this week` : '',
      icon: CalendarCheck,
      color: 'bg-emerald-500/10 text-emerald-500',
    },
    {
      label: 'New leads today',
      value: business ? business.newLeadsToday.toLocaleString() : '—',
      sub: business ? `${business.totalLeads.toLocaleString()} total` : '',
      icon: CalendarPlus,
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      label: 'Contact rate',
      value: business ? `${business.contactRate.toFixed(1)}%` : '—',
      sub: business ? `${business.funnel.contacted} of ${business.totalLeads} leads` : '',
      icon: PhoneCall,
      color: 'bg-violet-500/10 text-violet-500',
    },
    {
      label: 'Total calls',
      value: metrics?.totalCalls.toLocaleString() ?? '0',
      sub: metrics ? `${formatDuration(metrics.averageDuration)} avg` : '',
      icon: Users,
      color: 'bg-cyan-500/10 text-cyan-500',
    },
    {
      label: 'Avg calls before RDV',
      value: business ? business.avgCallsBeforeRdv.toFixed(1) : '—',
      sub: 'Lower is better',
      icon: Repeat,
      color: 'bg-amber-500/10 text-amber-500',
    },
    {
      label: 'Wrong / no-answer',
      value: business ? wrongNumberCount(business).toLocaleString() : '—',
      sub: 'Lead-list quality',
      icon: PhoneOff,
      color: 'bg-rose-500/10 text-rose-500',
    },
    {
      label: 'Active now',
      value: metrics?.activeCalls.toString() ?? '0',
      sub: (metrics?.activeCalls ?? 0) > 0 ? 'Live calls in progress' : 'Idle',
      icon: Activity,
      color: 'bg-emerald-500/10 text-emerald-500',
      pulse: (metrics?.activeCalls ?? 0) > 0,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label} className={`py-4 ${t.highlight ? 'ring-1 ring-emerald-500/40' : ''}`}>
          <CardContent className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.color}`}>
              <t.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{t.label}</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-semibold">{t.value}</p>
                {t.pulse && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                )}
              </div>
              {t.sub && <p className="text-[11px] text-muted-foreground truncate">{t.sub}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function wrongNumberCount(b: BusinessMetrics): number {
  return b.qualifications
    .filter((q) => q.qualification === 'FAUX NUMERO' || q.qualification === 'PAS DE REPONSE')
    .reduce((sum, q) => sum + q.count, 0)
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
