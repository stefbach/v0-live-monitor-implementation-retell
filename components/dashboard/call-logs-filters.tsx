'use client'

import { useState } from 'react'
import { ChevronDown, Timer, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useFiltersStore } from '@/lib/stores/filters-store'
import { CRENEAUX } from '@/lib/timezone'
import { useT } from '@/lib/hooks/use-t'
import type { CreneauKey, TriState } from '@/lib/types'

const PHASES = ['J1', 'J3', 'J5', 'Inconnu']
const CRENEAU_KEYS: CreneauKey[] = [
  'creneau_1',
  'creneau_2',
  'creneau_3',
  'hors_creneau',
]
const DURATION_PRESETS = [60, 120, 180, 300, 600]

export function CallLogsFilters() {
  const { t } = useT()
  const filters = useFiltersStore((s) => s.filters)
  const patch = useFiltersStore((s) => s.patch)
  const toggleArray = useFiltersStore((s) => s.toggleArray)

  const advancedActive =
    (filters.phases?.length ?? 0) +
    (filters.creneaux?.length ?? 0) +
    (filters.voicemail !== 'all' ? 1 : 0) +
    (filters.robot !== 'all' ? 1 : 0) +
    (filters.minDurationSec != null ? 1 : 0)

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Manual duration in seconds */}
        <div className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1">
          <Timer className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t('logs.filters.durationGT')}</span>
          <Input
            type="number"
            min={0}
            placeholder="sec"
            value={filters.minDurationSec ?? ''}
            onChange={(e) =>
              patch({
                minDurationSec:
                  e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
              })
            }
            className="h-7 w-20"
          />
          <span className="text-xs text-muted-foreground">s</span>
          <div className="flex gap-1">
            {DURATION_PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => patch({ minDurationSec: s })}
                className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                  filters.minDurationSec === s
                    ? 'bg-primary text-primary-foreground'
                    : 'border hover:bg-muted'
                }`}
              >
                {s / 60}min
              </button>
            ))}
          </div>
        </div>

        <MultiPill
          label={t('logs.filters.phase')}
          count={filters.phases?.length ?? 0}
          options={PHASES.map((p) => ({ id: p, label: p }))}
          selected={filters.phases ?? []}
          onToggle={(v) => toggleArray('phases', v)}
        />
        <MultiPill
          label={t('logs.filters.creneau')}
          count={filters.creneaux?.length ?? 0}
          options={CRENEAU_KEYS.map((k) => ({ id: k, label: CRENEAUX[k].short }))}
          selected={filters.creneaux ?? []}
          onToggle={(v) => toggleArray('creneaux', v as CreneauKey)}
        />

        <TriPill
          label={t('common.answered')}
          value={filters.answered === 'answered' ? 'yes' : filters.answered === 'no_answer' ? 'no' : 'all'}
          onChange={(v) =>
            patch({
              answered: v === 'yes' ? 'answered' : v === 'no' ? 'no_answer' : 'all',
            })
          }
        />
        <TriPill
          label={t('logs.filters.voicemail')}
          value={filters.voicemail}
          onChange={(v) => patch({ voicemail: v })}
        />
        <TriPill
          label={t('logs.filters.robot')}
          value={filters.robot}
          onChange={(v) => patch({ robot: v })}
        />

        {advancedActive > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() =>
              patch({
                phases: [],
                creneaux: [],
                voicemail: 'all',
                robot: 'all',
                minDurationSec: null,
              })
            }
          >
            <RotateCcw className="h-3.5 w-3.5" /> {t('logs.filters.advanced')}
            <Badge variant="secondary" className="ml-1 text-xs">
              {advancedActive}
            </Badge>
          </Button>
        )}
      </div>
    </div>
  )
}

function MultiPill({
  label,
  count,
  options,
  selected,
  onToggle,
}: {
  label: string
  count: number
  options: { id: string; label: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const sel = new Set(selected)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={count > 0 ? 'default' : 'outline'} size="sm" className="h-8 gap-1">
          {label}
          {count > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 text-xs">
              {count}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onToggle(o.id)}
            className={`flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-sm transition-colors ${
              sel.has(o.id) ? 'bg-muted' : 'hover:bg-muted/50'
            }`}
          >
            <span>{o.label}</span>
            {sel.has(o.id) && <span className="text-xs text-muted-foreground">✓</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function TriPill({
  label,
  value,
  onChange,
}: {
  label: string
  value: TriState
  onChange: (v: TriState) => void
}) {
  const { t } = useT()
  const opts: { id: TriState; label: string }[] = [
    { id: 'all', label: t('common.all') },
    { id: 'yes', label: t('common.yes') },
    { id: 'no', label: t('common.no') },
  ]
  return (
    <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
      <span className="px-2 text-xs text-muted-foreground">{label}</span>
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            value === o.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
