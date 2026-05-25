'use client'

import { useMemo } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts'
import { DollarSign, Calendar, Banknote, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { computeCostByHour, computeCostByOutcome } from '@/lib/analytics'
import { periodRange, previousPeriodRange } from '@/lib/filters'
import { useFiltersStore } from '@/lib/stores/filters-store'
import { useRdvStore } from '@/lib/stores/rdv-store'
import { effectiveQualKey } from '@/lib/rdv'
import type { CallLogEnriched } from '@/lib/types'

interface Props {
  allCalls: CallLogEnriched[] // unfiltered — needed for previous period comparison
  filteredCalls: CallLogEnriched[] // filtered by current selection
  isLoading?: boolean
}

function formatUsd(cents: number): string {
  if (!Number.isFinite(cents)) return '—'
  if (Math.abs(cents) >= 100_000) return `$${(cents / 100000).toFixed(2)}k`
  return `$${(cents / 100).toFixed(2)}`
}

const chartConfig: ChartConfig = {
  cost: { label: 'Cost', color: 'hsl(38, 92%, 50%)' },
}

const QUALIF_COLOR: Record<string, string> = {
  'RDV MEDECIN': 'hsl(142, 71%, 45%)',
  'NOUVEAU DOSSIER': 'hsl(217, 91%, 60%)',
  'PAS INTERESSE': 'hsl(0, 84%, 60%)',
  'PAS DE REPONSE': 'hsl(38, 92%, 50%)',
  'FAUX NUMERO': 'hsl(346, 87%, 43%)',
  'FOLLOW UP': 'hsl(271, 91%, 65%)',
  UNMATCHED: 'hsl(0, 0%, 50%)',
}

export function CostAdvanced({ allCalls, filteredCalls, isLoading }: Props) {
  const filters = useFiltersStore((s) => s.filters)
  const confirmedRdvLeadKeys = useRdvStore((s) => s.confirmedRdvLeadKeys)

  const summary = useMemo(() => {
    const totalCost = filteredCalls.reduce((s, c) => s + (c.cost ?? 0), 0)
    const rdvCalls = filteredCalls.filter(
      (c) => effectiveQualKey(c, confirmedRdvLeadKeys) === 'rdv_confirme'
    ).length
    const wastedCalls = filteredCalls.filter((c) => {
      const q = effectiveQualKey(c, confirmedRdvLeadKeys)
      return q === 'faux_numero' || q === 'pas_de_reponse'
    })
    const wastedCost = wastedCalls.reduce((s, c) => s + (c.cost ?? 0), 0)
    return {
      totalCost,
      avgCostPerCall: filteredCalls.length > 0 ? totalCost / filteredCalls.length : 0,
      costPerRdv: rdvCalls > 0 ? totalCost / rdvCalls : 0,
      wastedCost,
      wastedRatio: totalCost > 0 ? (wastedCost / totalCost) * 100 : 0,
    }
  }, [filteredCalls, confirmedRdvLeadKeys])

  const prevSummary = useMemo(() => {
    const prev = previousPeriodRange(filters.period, filters.customStart, filters.customEnd)
    const inPrev = allCalls.filter((c) => {
      const t = c.startTime ? new Date(c.startTime).getTime() : 0
      return t >= prev.start && t < prev.end
    })
    const cost = inPrev.reduce((s, c) => s + (c.cost ?? 0), 0)
    return { totalCost: cost, count: inPrev.length }
  }, [allCalls, filters.period, filters.customStart, filters.customEnd])

  const delta = summary.totalCost - prevSummary.totalCost
  const deltaPct =
    prevSummary.totalCost > 0
      ? ((summary.totalCost - prevSummary.totalCost) / prevSummary.totalCost) * 100
      : summary.totalCost > 0
        ? 100
        : 0

  // Daily series
  const daily = useMemo(() => {
    const map = new Map<string, { cost: number; calls: number }>()
    for (const c of filteredCalls) {
      const t = c.startTime ? new Date(c.startTime).getTime() : 0
      if (!t) continue
      const dayKey = new Date(t).toISOString().split('T')[0]
      const bucket = map.get(dayKey) ?? { cost: 0, calls: 0 }
      bucket.cost += c.cost ?? 0
      bucket.calls += 1
      map.set(dayKey, bucket)
    }
    return [...map.entries()]
      .map(([date, v]) => ({ date, cost: v.cost / 100, calls: v.calls }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
  }, [filteredCalls])

  const byHour = useMemo(() => computeCostByHour(filteredCalls), [filteredCalls])
  const byOutcome = useMemo(
    () => computeCostByOutcome(filteredCalls, confirmedRdvLeadKeys),
    [filteredCalls, confirmedRdvLeadKeys]
  )

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Call costs</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    )
  }

  const periodLabel = filters.period === 'today' ? 'Today' :
    filters.period === 'yesterday' ? 'Yesterday' :
    filters.period === '7d' ? 'Last 7 days' :
    filters.period === '30d' ? 'Last 30 days' :
    filters.period === 'all' ? 'All time' : 'Custom range'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Call costs · {periodLabel}</CardTitle>
        <CardDescription>
          {formatUsd(summary.totalCost)} spent ·{' '}
          {delta >= 0 ? '+' : ''}
          {formatUsd(delta)} vs previous period ({deltaPct.toFixed(0)}%)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <CostTile
            label="Total spend"
            value={formatUsd(summary.totalCost)}
            icon={Banknote}
            color="bg-amber-500/10 text-amber-500"
            sub={`${filteredCalls.length.toLocaleString()} calls`}
          />
          <CostTile
            label="Avg / call"
            value={formatUsd(summary.avgCostPerCall)}
            icon={DollarSign}
            color="bg-cyan-500/10 text-cyan-500"
          />
          <CostTile
            label="Cost per RDV"
            value={formatUsd(summary.costPerRdv)}
            icon={TrendingDown}
            color="bg-emerald-500/10 text-emerald-500"
            highlight
          />
          <CostTile
            label="Wasted (faux #, no answer)"
            value={formatUsd(summary.wastedCost)}
            icon={Calendar}
            color="bg-rose-500/10 text-rose-500"
            sub={`${summary.wastedRatio.toFixed(0)}% of spend`}
          />
        </div>

        {/* Daily series */}
        {daily.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Daily spend
            </p>
            <ChartContainer config={chartConfig} className="h-[160px] w-full">
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="costFill2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  width={40}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="hsl(38, 92%, 50%)"
                  fill="url(#costFill2)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}

        {/* Cost by hour */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cost by hour
            </p>
            <ChartContainer config={chartConfig} className="h-[160px] w-full">
              <BarChart data={byHour.map((b) => ({ ...b, cost: b.cost / 100 }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => (v % 3 === 0 ? `${v}h` : '')}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  width={40}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="cost" fill="hsl(38, 92%, 50%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cost by outcome
            </p>
            <ChartContainer config={chartConfig} className="h-[160px] w-full">
              <BarChart
                data={byOutcome.map((b) => ({ ...b, costDollar: b.cost / 100 }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="opacity-30" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                />
                <YAxis
                  type="category"
                  dataKey="qualification"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  width={110}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="costDollar" radius={[0, 2, 2, 0]}>
                  {byOutcome.map((b) => (
                    <Cell key={b.qualification} fill={QUALIF_COLOR[b.qualification] ?? 'hsl(0,0%,50%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CostTile({
  label,
  value,
  icon: Icon,
  color,
  sub,
  highlight,
}: {
  label: string
  value: string
  icon: typeof DollarSign
  color: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        highlight ? 'ring-1 ring-emerald-500/40' : ''
      }`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-md ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className="text-base font-semibold font-mono">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  )
}

void periodRange
