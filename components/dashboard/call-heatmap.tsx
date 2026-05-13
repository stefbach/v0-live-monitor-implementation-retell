'use client'

import { useMemo, useState } from 'react'
import { Flame, PhoneCall, CalendarCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { computeHeatmap } from '@/lib/analytics'
import type { CallLogEnriched } from '@/lib/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface Props {
  calls: CallLogEnriched[]
  isLoading?: boolean
}

type Mode = 'answer' | 'rdv'

function colorFor(rate: number, mode: Mode, total: number): string {
  if (total === 0) return 'bg-muted/30'
  const intensity = Math.min(1, rate / (mode === 'rdv' ? 30 : 80))
  if (mode === 'answer') {
    // blue gradient
    if (intensity < 0.15) return 'bg-blue-500/10'
    if (intensity < 0.3) return 'bg-blue-500/25'
    if (intensity < 0.5) return 'bg-blue-500/40'
    if (intensity < 0.7) return 'bg-blue-500/60'
    return 'bg-blue-500/85'
  }
  // emerald for RDV
  if (intensity < 0.15) return 'bg-emerald-500/10'
  if (intensity < 0.3) return 'bg-emerald-500/25'
  if (intensity < 0.5) return 'bg-emerald-500/45'
  if (intensity < 0.7) return 'bg-emerald-500/65'
  return 'bg-emerald-500/90'
}

export function CallHeatmap({ calls, isLoading }: Props) {
  const [mode, setMode] = useState<Mode>('answer')
  const cells = useMemo(() => computeHeatmap(calls), [calls])

  const topSlots = useMemo(() => {
    return [...cells]
      .filter((c) => c.total >= 3) // require minimum sample
      .sort((a, b) => (mode === 'rdv' ? b.rdvRate - a.rdvRate : b.answerRate - a.answerRate))
      .slice(0, 3)
  }, [cells, mode])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">When to call</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" />
              When to call — Day × Hour
            </CardTitle>
            <CardDescription>
              {mode === 'answer'
                ? 'Real answer rate by slot (call >15s, valid disconnect)'
                : 'RDV conversion rate by slot'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
            <button
              onClick={() => setMode('answer')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors gap-1 inline-flex items-center ${
                mode === 'answer'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PhoneCall className="h-3 w-3" /> Answer rate
            </button>
            <button
              onClick={() => setMode('rdv')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors gap-1 inline-flex items-center ${
                mode === 'rdv'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarCheck className="h-3 w-3" /> RDV rate
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Heatmap grid */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="flex">
              <div className="w-10 shrink-0" />
              <div className="grid grid-cols-24 gap-px flex-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                {HOURS.map((h) => (
                  <div key={h} className="text-[9px] text-muted-foreground text-center font-mono">
                    {h % 3 === 0 ? `${h}h` : ''}
                  </div>
                ))}
              </div>
            </div>
            {DAYS.map((day, d) => (
              <div key={day} className="flex items-center gap-px mt-px">
                <div className="w-10 shrink-0 text-[11px] text-muted-foreground font-medium">{day}</div>
                <div
                  className="grid gap-px flex-1"
                  style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
                >
                  {HOURS.map((h) => {
                    const cell = cells.find((c) => c.dayOfWeek === d && c.hour === h)!
                    const rate = mode === 'rdv' ? cell.rdvRate : cell.answerRate
                    const tip = `${day} ${h}:00 · ${cell.total} calls · ${mode === 'rdv' ? `${cell.rdv} RDV` : `${cell.answered} answered`} (${rate.toFixed(0)}%)`
                    return (
                      <div
                        key={h}
                        title={tip}
                        className={`h-6 rounded-sm ${colorFor(rate, mode, cell.total)} hover:ring-1 hover:ring-foreground/50 cursor-help`}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend + top slots */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>Low</span>
            <span className={`h-3 w-4 rounded-sm ${colorFor(5, mode, 1)}`} />
            <span className={`h-3 w-4 rounded-sm ${colorFor(25, mode, 1)}`} />
            <span className={`h-3 w-4 rounded-sm ${colorFor(50, mode, 1)}`} />
            <span className={`h-3 w-4 rounded-sm ${colorFor(75, mode, 1)}`} />
            <span className={`h-3 w-4 rounded-sm ${colorFor(100, mode, 1)}`} />
            <span>High</span>
          </div>
          {topSlots.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Top slots:</span>
              {topSlots.map((s) => (
                <Badge key={`${s.dayOfWeek}-${s.hour}`} variant="outline" className="font-mono text-xs">
                  {DAYS[s.dayOfWeek]} {s.hour}h ·{' '}
                  <span className={mode === 'rdv' ? 'text-emerald-500' : 'text-blue-500'}>
                    {(mode === 'rdv' ? s.rdvRate : s.answerRate).toFixed(0)}%
                  </span>{' '}
                  <span className="text-muted-foreground">({s.total})</span>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
