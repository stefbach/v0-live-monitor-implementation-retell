'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Calendar, DollarSign, TrendingDown, Banknote } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import type { CostSummary } from '@/lib/types'

interface Props {
  cost: CostSummary | null
  isLoading?: boolean
}

function formatUsd(cents: number): string {
  if (!Number.isFinite(cents)) return '—'
  if (Math.abs(cents) >= 100_000) return `$${(cents / 100000).toFixed(2)}k`
  return `$${(cents / 100).toFixed(2)}`
}

const chartConfig: ChartConfig = {
  cost: { label: 'Cost', color: 'hsl(38, 92%, 50%)' }, // amber
}

export function CostOverview({ cost, isLoading }: Props) {
  if (isLoading || !cost) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Call costs</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    )
  }

  const kpis = [
    {
      label: 'Today',
      value: formatUsd(cost.todayCost),
      icon: Calendar,
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      label: 'Last 7 days',
      value: formatUsd(cost.weekCost),
      icon: Calendar,
      color: 'bg-violet-500/10 text-violet-500',
    },
    {
      label: 'This month',
      value: formatUsd(cost.monthCost),
      icon: Banknote,
      color: 'bg-amber-500/10 text-amber-500',
    },
    {
      label: 'Avg / call',
      value: formatUsd(cost.avgCostPerCall),
      icon: DollarSign,
      color: 'bg-cyan-500/10 text-cyan-500',
    },
    {
      label: 'Cost per RDV',
      value: formatUsd(cost.costPerRdv),
      icon: TrendingDown,
      color: 'bg-emerald-500/10 text-emerald-500',
      highlight: true,
    },
  ]

  const chartData = cost.daily.map((p) => ({
    date: p.date,
    cost: p.cost / 100, // dollars
    calls: p.calls,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Call costs</CardTitle>
        <CardDescription>
          Total spend {formatUsd(cost.totalCost)} · {chartData.length}-day window
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((k) => (
            <div
              key={k.label}
              className={`flex items-center gap-2 rounded-lg border p-3 ${
                k.highlight ? 'ring-1 ring-emerald-500/40' : ''
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-md ${k.color}`}>
                <k.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">{k.label}</p>
                <p className="text-base font-semibold font-mono">{k.value}</p>
              </div>
            </div>
          ))}
        </div>
        {chartData.length > 0 && (
          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#costFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
