'use client'

import { Cell, Pie, PieChart } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useFiltersStore } from '@/lib/stores/filters-store'
import type { QualificationBreakdown as QB } from '@/lib/types'

interface Props {
  data: QB[]
  isLoading?: boolean
}

const COLOR_MAP: Record<string, string> = {
  'RDV MEDECIN': 'hsl(142, 71%, 45%)',
  'NOUVEAU DOSSIER': 'hsl(217, 91%, 60%)',
  'PAS INTERESSE': 'hsl(0, 84%, 60%)',
  'PAS DE REPONSE': 'hsl(38, 92%, 50%)',
  'FAUX NUMERO': 'hsl(346, 87%, 43%)',
  'FOLLOW UP': 'hsl(271, 91%, 65%)',
  TRANSFERRED_TO_ISABELLE: 'hsl(187, 85%, 53%)',
}

function colorFor(q: string, i: number): string {
  return COLOR_MAP[q] ?? `hsl(${(i * 47) % 360}, 65%, 55%)`
}

export function QualificationBreakdown({ data, isLoading }: Props) {
  const toggle = useFiltersStore((s) => s.toggleArray)
  const selected = useFiltersStore((s) => s.filters.qualifications)
  const selSet = new Set(selected)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead qualification</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>
    )
  }

  const chartData = data.map((d, i) => ({
    name: d.qualification,
    value: d.count,
    fill: colorFor(d.qualification, i),
  }))

  const chartConfig: ChartConfig = Object.fromEntries(
    chartData.map((d) => [d.name, { label: d.name, color: d.fill }])
  )

  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Lead qualification</CardTitle>
        <CardDescription>
          {total.toLocaleString()} leads classified · click a slice to filter
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <ChartContainer config={chartConfig} className="aspect-square h-[220px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                strokeWidth={2}
                onClick={(payload) => {
                  const name = (payload as { name?: string }).name
                  if (name) toggle('qualifications', name)
                }}
              >
                {chartData.map((d) => (
                  <Cell
                    key={d.name}
                    fill={d.fill}
                    style={{
                      cursor: 'pointer',
                      opacity: selSet.size === 0 || selSet.has(d.name) ? 1 : 0.3,
                    }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="flex-1 space-y-1 text-sm w-full">
            {data.map((d, i) => {
              const isSel = selSet.has(d.qualification)
              return (
                <li key={d.qualification}>
                  <button
                    onClick={() => toggle('qualifications', d.qualification)}
                    className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                      isSel ? 'bg-muted' : 'hover:bg-muted/50'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: colorFor(d.qualification, i) }}
                      />
                      <span className="truncate">{d.qualification}</span>
                    </span>
                    <span className="font-mono text-muted-foreground text-xs">
                      {d.count.toLocaleString()}{' '}
                      <span>({d.percent.toFixed(1)}%)</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
