'use client'

import { useMemo, useState } from 'react'
import { Flame, PhoneCall, CalendarCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { computeHeatmap } from '@/lib/analytics'
import { useT } from '@/lib/hooks/use-t'
import { DetailSlideOver } from './director/detail-slideover'
import type { CallLogEnriched } from '@/lib/types'

const DAY_KEYS = ['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface Props {
  calls: CallLogEnriched[]
  onSelectCall?: (call: CallLogEnriched) => void
  isLoading?: boolean
}

type Mode = 'answer' | 'rdv'

// Linear blend from light gray (zinc-200) to deep emerald (emerald-800)
// driven by the rate. Returns inline CSS so it renders identically in
// dark and light themes.
function cellStyle(
  rate: number,
  total: number
): { background: string; color: string } {
  if (total === 0) {
    return {
      background: 'rgba(120, 120, 120, 0.10)',
      color: 'rgba(160, 160, 160, 0.5)',
    }
  }
  // Normalise: 0 % → 0, 60 %+ → 1 (avoid washed-out greens at the top)
  const t = Math.max(0, Math.min(1, rate / 60))
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t)
  // light → dark: rgb(229,231,235) → rgb(6,95,70)
  const r = lerp(229, 6)
  const g = lerp(231, 95)
  const b = lerp(235, 70)
  return {
    background: `rgb(${r}, ${g}, ${b})`,
    color: t > 0.5 ? 'rgb(255,255,255)' : 'rgb(30,30,40)',
  }
}

export function CallHeatmap({
  calls,
  onSelectCall,
  isLoading,
}: Props) {
  const { t } = useT()
  const [mode, setMode] = useState<Mode>('answer')
  const [panel, setPanel] = useState<{
    title: string
    calls: CallLogEnriched[]
  } | null>(null)

  const cells = useMemo(() => computeHeatmap(calls), [calls])

  // Top 3 slots: minimum 3 calls in the slot to avoid noise
  const topKey = (dow: number, h: number) => `${dow}-${h}`
  const topSet = useMemo(() => {
    const arr = [...cells]
      .filter((c) => c.total >= 3)
      .sort((a, b) =>
        mode === 'rdv' ? b.rdvRate - a.rdvRate : b.answerRate - a.answerRate
      )
      .slice(0, 3)
    return {
      set: new Set(arr.map((c) => topKey(c.dayOfWeek, c.hour))),
      list: arr,
    }
  }, [cells, mode])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('heatmap.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    )
  }

  const openSlot = (d: number, h: number) => {
    const slotCalls = calls.filter(
      (c) => c.dayOfWeek === d && c.hourOfDay === h
    )
    setPanel({
      title: `${t(DAY_KEYS[d])} ${h}h00–${h + 1}h00 · ${slotCalls.length} appels`,
      calls: slotCalls,
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" />
              {t('heatmap.title')}
            </CardTitle>
            <CardDescription>
              {mode === 'answer' ? t('heatmap.desc.answer') : t('heatmap.desc.rdv')}
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
              <PhoneCall className="h-3 w-3" /> {t('heatmap.mode.answer')}
            </button>
            <button
              onClick={() => setMode('rdv')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors gap-1 inline-flex items-center ${
                mode === 'rdv'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarCheck className="h-3 w-3" /> {t('heatmap.mode.rdv')}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Heatmap grid */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Hour header row */}
            <div className="flex">
              <div className="w-12 shrink-0" />
              <div
                className="grid gap-1 flex-1"
                style={{ gridTemplateColumns: 'repeat(24, minmax(36px, 1fr))' }}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="text-center text-[10px] font-mono text-muted-foreground"
                  >
                    {h}h
                  </div>
                ))}
              </div>
            </div>
            {/* Day rows */}
            {DAY_KEYS.map((dayKey, d) => (
              <div key={dayKey} className="mt-1 flex items-center gap-1">
                <div className="w-12 shrink-0 text-xs font-medium text-muted-foreground">
                  {t(dayKey)}
                </div>
                <div
                  className="grid gap-1 flex-1"
                  style={{ gridTemplateColumns: 'repeat(24, minmax(36px, 1fr))' }}
                >
                  {HOURS.map((h) => {
                    const cell = cells.find(
                      (c) => c.dayOfWeek === d && c.hour === h
                    )!
                    const rate = mode === 'rdv' ? cell.rdvRate : cell.answerRate
                    const style = cellStyle(rate, cell.total)
                    const isTop = topSet.set.has(topKey(d, h))
                    const tip = `${t(dayKey)} ${h}h · ${cell.total} appels · ${
                      mode === 'rdv'
                        ? `${cell.rdv} RDV`
                        : `${cell.answered} décrochés`
                    } (${rate.toFixed(0)}%)`
                    return (
                      <button
                        key={h}
                        title={tip}
                        onClick={() => openSlot(d, h)}
                        disabled={cell.total === 0}
                        style={style}
                        className={`relative flex h-9 items-center justify-center rounded text-[11px] font-semibold transition-transform hover:scale-105 disabled:cursor-default disabled:hover:scale-100 ${
                          isTop ? 'ring-2 ring-amber-500 z-10' : ''
                        }`}
                      >
                        {cell.total > 0 ? `${rate.toFixed(0)}%` : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend + top slots */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{t('heatmap.legend.low')}</span>
              {[0, 15, 30, 45, 60].map((r) => {
                const s = cellStyle(r, 1)
                return (
                  <span
                    key={r}
                    style={s}
                    className="inline-flex h-4 w-7 items-center justify-center rounded text-[10px] font-medium"
                  >
                    {r}%
                  </span>
                )
              })}
              <span>{t('heatmap.legend.high')}</span>
            </div>
            <p className="text-[11px] text-muted-foreground italic">
              {mode === 'answer'
                ? t('heatmap.legend.answer')
                : t('heatmap.legend.rdv')}
            </p>
          </div>
          {topSet.list.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">
                {t('heatmap.top')} :
              </span>
              {topSet.list.map((s) => (
                <Badge
                  key={`${s.dayOfWeek}-${s.hour}`}
                  variant="outline"
                  className="border-amber-500/50 bg-amber-500/5 font-mono text-xs"
                >
                  {t(DAY_KEYS[s.dayOfWeek])} {s.hour}h ·{' '}
                  <span className="font-semibold text-emerald-500">
                    {(mode === 'rdv' ? s.rdvRate : s.answerRate).toFixed(0)}%
                  </span>{' '}
                  <span className="text-muted-foreground">({s.total})</span>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Click-through slide-over: calls of the selected slot */}
      <DetailSlideOver
        open={!!panel}
        onOpenChange={(o) => !o && setPanel(null)}
        title={panel?.title ?? ''}
        calls={panel?.calls ?? []}
        onSelectCall={(c) => {
          setPanel(null)
          onSelectCall?.(c)
        }}
      />
    </Card>
  )
}
