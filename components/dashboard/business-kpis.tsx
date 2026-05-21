'use client'

import { useMemo, useState } from 'react'
import {
  CalendarCheck,
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
import { leadGroupKey } from '@/lib/lead-key'
import { bmiOrNull } from '@/lib/bmi'
import { DetailSlideOver } from './director/detail-slideover'
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
  confirmedRdvLeadKeys?: Set<string>
  handoffLeadKeys?: Set<string>
  onSelectCall?: (call: CallLogEnriched) => void
  isLoading?: boolean
}

type KpiId =
  | 'rdv'
  | 'answer'
  | 'cost'
  | 'total'
  | 'eligible'
  | 'avg_attempts'
  | 'wrong'
  | 'active'

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
  confirmedRdvLeadKeys,
  handoffLeadKeys,
  onSelectCall,
  isLoading,
}: Props) {
  const filters = useFiltersStore((s) => s.filters)
  const confirmed = confirmedRdvLeadKeys ?? new Set<string>()
  const [panel, setPanel] = useState<{
    title: string
    calls: CallLogEnriched[]
  } | null>(null)

  const computed = useMemo(() => {
    const total = filteredCalls.length
    const answered = filteredCalls.filter((c) => c.answered).length
    // Strict RDV count (#1): leads in the confirmed set
    const rdvLeads = new Set<string>()
    for (const c of filteredCalls) {
      const k = leadGroupKey(c)
      if (k && confirmed.has(k)) rdvLeads.add(k)
    }
    const rdv = rdvLeads.size
    const cost = filteredCalls.reduce((s, c) => s + (c.cost ?? 0), 0)
    const wrongNum = filteredCalls.filter(
      (c) =>
        c.lead?.qualification === 'FAUX NUMERO' ||
        c.lead?.qualification === 'PAS DE REPONSE'
    ).length

    // Previous period comparison
    const prev = previousPeriodRange(filters.period, filters.customStart, filters.customEnd)
    const prevCalls = allCalls.filter((c) => {
      const t = c.startTime ? new Date(c.startTime).getTime() : 0
      return t >= prev.start && t < prev.end
    })
    const prevAnswered = prevCalls.filter((c) => c.answered).length
    const prevRdvLeads = new Set<string>()
    for (const c of prevCalls) {
      const k = leadGroupKey(c)
      if (k && confirmed.has(k)) prevRdvLeads.add(k)
    }
    const prevRdv = prevRdvLeads.size
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
  }, [filteredCalls, allCalls, filters, confirmed])

  // Eligible leads in pipeline (forward-looking, full lead set)
  const eligibleLeadIds = useMemo(() => {
    const ids = new Set<string>()
    for (const l of leads) {
      const bmi = bmiOrNull(l.bmi)
      if (bmi != null && bmi >= 40 && l.qualification !== 'RDV MEDECIN') {
        ids.add(l.id)
      }
    }
    return ids
  }, [leads])

  // Resolver: given a KPI id, return the calls to show in the slide-over
  const callsForId = (id: KpiId): CallLogEnriched[] => {
    switch (id) {
      case 'rdv':
        return filteredCalls.filter((c) => {
          const k = leadGroupKey(c)
          return !!k && confirmed.has(k)
        })
      case 'answer':
        return filteredCalls.filter((c) => c.answered)
      case 'cost':
        return [...filteredCalls].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
      case 'wrong':
        return filteredCalls.filter(
          (c) =>
            c.lead?.qualification === 'FAUX NUMERO' ||
            c.lead?.qualification === 'PAS DE REPONSE'
        )
      case 'eligible':
        return filteredCalls.filter((c) => c.lead?.id && eligibleLeadIds.has(c.lead.id))
      case 'avg_attempts':
        return filteredCalls.filter((c) => {
          const k = leadGroupKey(c)
          return !!k && confirmed.has(k)
        })
      case 'active':
      case 'total':
      default:
        return filteredCalls
    }
  }

  const openKpi = (id: KpiId, label: string) => {
    setPanel({ title: label, calls: callsForId(id) })
  }

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

  const tiles: TileSpec[] = [
    {
      id: 'rdv',
      label: 'RDV booked',
      value: computed.rdv.toLocaleString(),
      delta: computed.rdvDelta,
      sub: `${computed.rdvCallRate.toFixed(1)}% of calls`,
      icon: CalendarCheck,
      color: 'bg-emerald-500/10 text-emerald-500',
      highlight: true,
    },
    {
      id: 'answer',
      label: 'Answer rate',
      value: `${computed.answerRate.toFixed(1)}%`,
      delta: computed.answeredDelta,
      sub: `${computed.answered.toLocaleString()} / ${computed.total.toLocaleString()} calls`,
      icon: PhoneCall,
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      id: 'cost',
      label: 'Cost in period',
      value: formatUsd(computed.cost),
      delta: computed.costDelta,
      sub: `${formatUsd(computed.costPerRdv)} per RDV`,
      icon: DollarSign,
      color: 'bg-amber-500/10 text-amber-500',
      invertDelta: true,
    },
    {
      id: 'total',
      label: 'Total calls',
      value: computed.total.toLocaleString(),
      delta: computed.callsDelta,
      sub: business ? `${business.totalLeads.toLocaleString()} leads in DB` : '',
      icon: Users,
      color: 'bg-cyan-500/10 text-cyan-500',
    },
    {
      id: 'eligible',
      label: 'Eligible in pipeline',
      value: eligibleLeadIds.size.toLocaleString(),
      sub: 'BMI ≥ 40 & not RDV',
      icon: TrendingUp,
      color: 'bg-violet-500/10 text-violet-500',
    },
    {
      id: 'avg_attempts',
      label: 'Avg calls before RDV',
      value: business ? business.avgCallsBeforeRdv.toFixed(1) : '—',
      sub: 'Lower is better',
      icon: Repeat,
      color: 'bg-violet-500/10 text-violet-500',
    },
    {
      id: 'wrong',
      label: 'Wrong # / no answer',
      value: computed.wrongNum.toLocaleString(),
      sub: 'List quality',
      icon: PhoneOff,
      color: 'bg-rose-500/10 text-rose-500',
    },
    {
      id: 'active',
      label: 'Active now',
      value: metrics?.activeCalls.toString() ?? '0',
      sub: (metrics?.activeCalls ?? 0) > 0 ? 'Live calls' : 'Idle',
      icon: Activity,
      color: 'bg-emerald-500/10 text-emerald-500',
      pulse: (metrics?.activeCalls ?? 0) > 0,
      noClick: true, // active calls don't live in filteredCalls
    },
  ]

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Tile
            key={t.id}
            {...t}
            onClick={
              t.noClick ? undefined : () => openKpi(t.id, t.label)
            }
          />
        ))}
      </div>

      <DetailSlideOver
        open={!!panel}
        onOpenChange={(o) => !o && setPanel(null)}
        title={panel?.title ?? ''}
        calls={panel?.calls ?? []}
        confirmedRdvLeadKeys={confirmedRdvLeadKeys}
        handoffLeadKeys={handoffLeadKeys}
        onSelectCall={(c) => {
          setPanel(null)
          onSelectCall?.(c)
        }}
      />
    </>
  )
}

interface TileSpec {
  id: KpiId
  label: string
  value: string
  delta?: DeltaValue
  sub?: string
  icon: typeof CalendarCheck
  color: string
  highlight?: boolean
  pulse?: boolean
  invertDelta?: boolean
  noClick?: boolean
}

function Tile({
  label,
  value,
  delta,
  sub,
  icon: Icon,
  color,
  highlight,
  pulse,
  invertDelta,
  onClick,
}: TileSpec & { onClick?: () => void }) {
  const showDelta = delta && (delta.current !== 0 || delta.previous !== 0)
  const positiveSign = invertDelta ? delta && delta.delta < 0 : delta && delta.delta > 0
  const deltaIcon = (delta?.delta ?? 0) >= 0 ? TrendingUp : TrendingDown
  const DeltaIconComp = deltaIcon

  const card = (
    <Card
      className={`py-4 transition-shadow ${
        highlight ? 'ring-1 ring-emerald-500/40' : ''
      } ${onClick ? 'hover:shadow-md' : ''}`}
    >
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

  if (!onClick) return card
  return (
    <button onClick={onClick} className="text-left">
      {card}
    </button>
  )
}

