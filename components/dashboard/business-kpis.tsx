'use client'

import { useMemo } from 'react'
import {
  CalendarCheck,
  CalendarPlus,
  PhoneOff,
  PhoneCall,
  TrendingUp,
  TrendingDown,
  Activity,
  Repeat,
  DollarSign,
  Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { previousPeriodRange } from '@/lib/filters'
import { makeDelta } from '@/lib/analytics'
import { useFiltersStore } from '@/lib/stores/filters-store'
import type {
  BusinessMetrics,
  CallMetrics,
  CallLogEnriched,
  Lead,
  DeltaValue,
} from '@/lib/types'

interface Props {
  metrics: CallMetrics | null
  business: BusinessMetrics | null
  filteredCalls: CallLogEnriched[]
  allCalls: CallLogEnriched[]
  leads: Lead[]
  isLoading?: boolean
}

function formatUsd(cents: number): string {
  if (Math.abs(cents) >= 100_000) return `$${(cents / 100000).toFixed(2)}k`
  return `$${(cents / 100).toFixed(2)}`
}

export function BusinessKpis({
  metrics,
  business,
  filteredCalls,
  allCalls,
  leads,
  isLoading,
}: Props) {
  const filters = useFiltersStore((s) => s.filters)

  const computed = useMemo(() => {
    const total = filteredCalls.length
    const answered = filteredCalls.filter((c) => c.answered).length
    const rdv = filteredCalls.filter((c) => c.lead?.qualification === 'RDV MEDECIN').length
    const cost = filteredCalls.reduce((s, c) => s + (c.cost ?? 0), 0)
    const wrongNum = filteredCalls.filter(
      (c) => c.lead?.qualification === 'FAUX NUMERO' || c.lead?.qualification === 'PAS DE REPONSE'
    ).length

    // Previous period comparison
    const prev = previousPeriodRange(filters.period, filters.customStart, filters.customEnd)
    const prevCalls = allCalls.filter((c) => {
      const t = c.startTime ? new Date(c.startTime).getTime() : 0
      return t >= prev.start && t < prev.end
    })
    const prevAnswered = prevCalls.filter((c) => c.answered).length
    const prevRdv = prevCalls.filter((c) => c.lead?.qualification === 'RDV MEDECIN').length
    const prevCost = prevCalls.reduce((s, c) => s + (c.cost ?? 0), 0)

    return {
      total,
      answered,
      rdv,
      cost,
      wrongNum,
      answerRate: total > 0 ? (answered / total) * 100 : 0,
      rdvCallRate: total > 0 ? (rdv / total) * 100 : 0,
      costPerRdv: rdv > 0 ? cost / rdv : 0,
      callsDelta: makeDelta(total, prevCalls.length),
      answeredDelta: makeDelta(answered, prevAnswered),
      rdvDelta: makeDelta(rdv, prevRdv),
      costDelta: makeDelta(cost, prevCost),
    }
  }, [filteredCalls, allCalls, filters])

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

  // Eligible-in-pipeline rough count from leads (unfiltered, forward-looking)
  // Quick estimate without scanning comorbidities here (eligibility pipeline section does the full pass)
  const eligibleRough = leads.filter((l) => {
    const bmi = l.bmi
    return typeof bmi === 'number' && bmi >= 40 && l.qualification !== 'RDV MEDECIN'
  }).length

  const tiles: TileSpec[] = [
    {
      label: 'RDV booked',
      value: computed.rdv.toLocaleString(),
      delta: computed.rdvDelta,
      sub: `${computed.rdvCallRate.toFixed(1)}% of calls`,
      icon: CalendarCheck,
      color: 'bg-emerald-500/10 text-emerald-500',
      highlight: true,
    },
    {
      label: 'Answer rate',
      value: `${computed.answerRate.toFixed(1)}%`,
      delta: computed.answeredDelta,
      sub: `${computed.answered.toLocaleString()} / ${computed.total.toLocaleString()} calls`,
      icon: PhoneCall,
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      label: 'Cost in period',
      value: formatUsd(computed.cost),
      delta: computed.costDelta,
      sub: `${formatUsd(computed.costPerRdv)} per RDV`,
      icon: DollarSign,
      color: 'bg-amber-500/10 text-amber-500',
      invertDelta: true, // higher cost is worse
    },
    {
      label: 'Total calls',
      value: computed.total.toLocaleString(),
      delta: computed.callsDelta,
      sub: business ? `${business.totalLeads.toLocaleString()} leads in DB` : '',
      icon: Users,
      color: 'bg-cyan-500/10 text-cyan-500',
    },
    {
      label: 'Eligible in pipeline',
      value: eligibleRough.toLocaleString(),
      sub: 'BMI ≥ 40 & not RDV',
      icon: TrendingUp,
      color: 'bg-violet-500/10 text-violet-500',
    },
    {
      label: 'Avg calls before RDV',
      value: business ? business.avgCallsBeforeRdv.toFixed(1) : '—',
      sub: 'Lower is better',
      icon: Repeat,
      color: 'bg-violet-500/10 text-violet-500',
    },
    {
      label: 'Wrong # / no answer',
      value: computed.wrongNum.toLocaleString(),
      sub: 'List quality',
      icon: PhoneOff,
      color: 'bg-rose-500/10 text-rose-500',
    },
    {
      label: 'Active now',
      value: metrics?.activeCalls.toString() ?? '0',
      sub: (metrics?.activeCalls ?? 0) > 0 ? 'Live calls' : 'Idle',
      icon: Activity,
      color: 'bg-emerald-500/10 text-emerald-500',
      pulse: (metrics?.activeCalls ?? 0) > 0,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <Tile key={t.label} {...t} />
      ))}
    </div>
  )
}

interface TileSpec {
  label: string
  value: string
  delta?: DeltaValue
  sub?: string
  icon: typeof CalendarCheck
  color: string
  highlight?: boolean
  pulse?: boolean
  invertDelta?: boolean
}

function Tile({ label, value, delta, sub, icon: Icon, color, highlight, pulse, invertDelta }: TileSpec) {
  const showDelta = delta && (delta.current !== 0 || delta.previous !== 0)
  const positiveSign = invertDelta ? delta && delta.delta < 0 : delta && delta.delta > 0
  const deltaIcon = (delta?.delta ?? 0) >= 0 ? TrendingUp : TrendingDown
  const DeltaIconComp = deltaIcon

  return (
    <Card className={`py-4 ${highlight ? 'ring-1 ring-emerald-500/40' : ''}`}>
      <CardContent className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <div className="flex items-center gap-2">
            <p className="text-xl font-semibold">{value}</p>
            {pulse && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>
          {showDelta && delta && (
            <p
              className={`text-[11px] font-mono flex items-center gap-0.5 ${
                positiveSign ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              <DeltaIconComp className="h-3 w-3" />
              {delta.pctChange >= 0 ? '+' : ''}
              {delta.pctChange.toFixed(0)}% vs prev
            </p>
          )}
          {!showDelta && sub && (
            <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
