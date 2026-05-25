'use client'

import { useMemo, useState } from 'react'
import { Search, X, ChevronDown, RotateCcw, CalendarRange } from 'lucide-react'
import { type DateRange } from 'react-day-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useFiltersStore } from '@/lib/stores/filters-store'
import { useT } from '@/lib/hooks/use-t'
import { DURATION_BUCKETS, PERIODS } from '@/lib/filters'
import type {
  CallLogEnriched,
  AttemptBucketId,
  DurationBucketId,
  PeriodId,
} from '@/lib/types'

interface FilterBarProps {
  calls: CallLogEnriched[]
  agentNames: Record<string, string>
}

const ATTEMPT_OPTIONS: { id: AttemptBucketId; label: string }[] = [
  { id: '1', label: '1st call' },
  { id: '2', label: '2nd call' },
  { id: '3plus', label: '3rd+ call' },
]

export function FilterBar({ calls, agentNames }: FilterBarProps) {
  const { t } = useT()
  const filters = useFiltersStore((s) => s.filters)
  const patch = useFiltersStore((s) => s.patch)
  const toggleArray = useFiltersStore((s) => s.toggleArray)
  const reset = useFiltersStore((s) => s.reset)

  const qualifs = useMemo(() => {
    const set = new Set<string>()
    for (const c of calls) if (c.lead?.qualification) set.add(c.lead.qualification)
    return [...set].sort()
  }, [calls])

  const sources = useMemo(() => {
    const set = new Set<string>()
    for (const c of calls) if (c.lead?.source_lead) set.add(c.lead.source_lead)
    return [...set].sort()
  }, [calls])

  const agentsInData = useMemo(() => {
    const set = new Set<string>()
    for (const c of calls) if (c.agentId) set.add(c.agentId)
    return [...set].sort()
  }, [calls])

  const activeCount =
    (filters.durations?.length ?? 0) +
    (filters.qualifications?.length ?? 0) +
    (filters.sources?.length ?? 0) +
    (filters.agents?.length ?? 0) +
    (filters.attempts?.length ?? 0) +
    (filters.eligibility !== 'all' ? 1 : 0) +
    (filters.answered !== 'all' ? 1 : 0) +
    (filters.search ? 1 : 0)

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Period selector */}
        <PeriodSelector />

        <div className="h-6 w-px bg-border" />

        {/* Multi-select pills */}
        <MultiSelectPill
          label={t('filter.duration')}
          count={filters.durations?.length ?? 0}
          options={DURATION_BUCKETS.map((d) => ({ id: d.id, label: d.label }))}
          selected={filters.durations ?? []}
          onToggle={(v) => toggleArray('durations', v as DurationBucketId)}
          onClear={() => patch({ durations: [] })}
        />
        <MultiSelectPill
          label={t('filter.qualification')}
          count={filters.qualifications?.length ?? 0}
          options={qualifs.map((q) => ({ id: q, label: q }))}
          selected={filters.qualifications ?? []}
          onToggle={(v) => toggleArray('qualifications', v)}
          onClear={() => patch({ qualifications: [] })}
        />
        <MultiSelectPill
          label={t('filter.source')}
          count={filters.sources?.length ?? 0}
          options={sources.map((s) => ({ id: s, label: s }))}
          selected={filters.sources ?? []}
          onToggle={(v) => toggleArray('sources', v)}
          onClear={() => patch({ sources: [] })}
        />
        <MultiSelectPill
          label={t('filter.agent')}
          count={filters.agents?.length ?? 0}
          options={agentsInData.map((id) => ({
            id,
            label: agentNames[id] || id.slice(0, 12),
          }))}
          selected={filters.agents ?? []}
          onToggle={(v) => toggleArray('agents', v)}
          onClear={() => patch({ agents: [] })}
        />
        <MultiSelectPill
          label={t('filter.attempt')}
          count={filters.attempts?.length ?? 0}
          options={ATTEMPT_OPTIONS.map((o) => ({ id: o.id, label: t(`attempt.${o.id}`) }))}
          selected={filters.attempts ?? []}
          onToggle={(v) => toggleArray('attempts', v as AttemptBucketId)}
          onClear={() => patch({ attempts: [] })}
        />

        <SinglePill
          label={t('filter.eligibility')}
          value={filters.eligibility}
          options={[
            { id: 'all', label: t('elig.all') },
            { id: 'eligible', label: t('elig.eligible') },
            { id: 'ineligible', label: t('elig.ineligible') },
            { id: 'unknown', label: t('elig.unknown') },
          ]}
          onChange={(v) => patch({ eligibility: v as typeof filters.eligibility })}
        />
        <SinglePill
          label={t('filter.answered')}
          value={filters.answered}
          options={[
            { id: 'all', label: t('ans.all') },
            { id: 'answered', label: t('ans.answered') },
            { id: 'no_answer', label: t('ans.no') },
          ]}
          onChange={(v) => patch({ answered: v as typeof filters.answered })}
        />

        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder={t('filter.search')}
            className="pl-9 h-9"
          />
        </div>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> {t('filter.reset')}
            <Badge variant="secondary" className="ml-1 text-xs">
              {activeCount}
            </Badge>
          </Button>
        )}
      </div>
    </div>
  )
}

function PeriodSelector() {
  const { t } = useT()
  const period = useFiltersStore((s) => s.filters.period)
  const customStart = useFiltersStore((s) => s.filters.customStart)
  const customEnd = useFiltersStore((s) => s.filters.customEnd)
  const patch = useFiltersStore((s) => s.patch)
  const [open, setOpen] = useState(false)

  // Local range state — committed to store only when both dates are picked.
  const [range, setRange] = useState<DateRange | undefined>(
    customStart && customEnd
      ? { from: new Date(customStart), to: new Date(customEnd) }
      : undefined
  )

  const handleRangeSelect = (r: DateRange | undefined) => {
    setRange(r)
    if (r?.from && r?.to) {
      // Set end-of-day for the "to" date so the full day is included.
      const end = new Date(r.to)
      end.setHours(23, 59, 59, 999)
      patch({
        period: 'custom',
        customStart: r.from.toISOString(),
        customEnd: end.toISOString(),
      })
      setOpen(false)
    }
  }

  const handleClear = () => {
    setRange(undefined)
    patch({ period: '7d', customStart: null, customEnd: null })
    setOpen(false)
  }

  const hasCustomRange = period === 'custom' && !!customStart && !!customEnd

  const customLabel = (() => {
    if (period !== 'custom' || !customStart || !customEnd) return t('period.custom')
    const fmt = (iso: string) =>
      new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    return `${fmt(customStart)} – ${fmt(customEnd)}`
  })()

  return (
    <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
      {PERIODS.filter((p) => p.id !== 'custom').map((p) => (
        <button
          key={p.id}
          onClick={() => patch({ period: p.id })}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            period === p.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t(`period.${p.id}`)}
        </button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              period === 'custom'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarRange className="h-3 w-3" />
            {customLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
            initialFocus
          />
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {range?.from && !range?.to
                ? 'Sélectionne la date de fin'
                : hasCustomRange
                  ? customLabel
                  : 'Choisis une plage de dates'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={!hasCustomRange && !range?.from}
              className="h-7 gap-1 text-xs"
            >
              <X className="h-3 w-3" />
              {t('filter.clear')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface PillOption {
  id: string
  label: string
}

function MultiSelectPill({
  label,
  count,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string
  count: number
  options: PillOption[]
  selected: string[]
  onToggle: (id: string) => void
  onClear: () => void
}) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const selSet = new Set(selected)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1"
        >
          {label}
          {count > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 text-xs">
              {count}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="max-h-72 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t('filter.noOptions')}</p>
          ) : (
            options.map((o) => {
              const isSel = selSet.has(o.id)
              return (
                <button
                  key={o.id}
                  onClick={() => onToggle(o.id)}
                  className={`flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-sm transition-colors ${
                    isSel ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <X className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              )
            })
          )}
        </div>
        {count > 0 && (
          <div className="mt-1 border-t pt-1">
            <button
              onClick={onClear}
              className="w-full rounded px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/50"
            >
              {t('filter.clear')} {label.toLowerCase()}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function SinglePill({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: PillOption[]
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.id === value)
  const isActive = value !== 'all'
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1"
        >
          {label}
          {isActive && selected && (
            <span className="text-xs font-normal opacity-80">· {selected.label}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              onChange(o.id)
              setOpen(false)
            }}
            className={`flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-sm transition-colors ${
              o.id === value ? 'bg-muted' : 'hover:bg-muted/50'
            }`}
          >
            <span>{o.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
