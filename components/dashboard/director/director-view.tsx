'use client'

import { useMemo, useState } from 'react'
import {
  Phone,
  PhoneCall,
  DollarSign,
  CalendarCheck,
  TrendingUp,
  Clock,
  RotateCcw,
  Timer,
  Users,
  UserPlus,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiStatus } from './api-status'
import { DetailSlideOver } from './detail-slideover'
import { ReportButton } from '../report-button'
import { HandoffDetailSheet } from './handoff-detail-sheet'
import { DurationHistogram } from '../duration-histogram'
import { VerbatimPanel } from '../verbatim-panel'
import { InboundCallsPanel } from '../inbound-calls-panel'
import { useT } from '@/lib/hooks/use-t'
import { formatBmi } from '@/lib/bmi'
import {
  computeDirectorKpis,
  callsForKpi,
  computeQualificationCounts,
  callsForQualification,
  computePhaseTracking,
  computeAgentBuckets,
  callsForAgentBucket,
  computeHandoffCandidates,
  type KpiId,
} from '@/lib/director-metrics'
import { QUAL_META, QUALIFICATION_CARDS, type QualKey } from '@/lib/qualifications'
import { useFiltersStore } from '@/lib/stores/filters-store'
import { useRdvStore } from '@/lib/stores/rdv-store'
import { PERIODS } from '@/lib/filters'
import type { CallLogEnriched, Lead } from '@/lib/types'

interface Props {
  filteredCalls: CallLogEnriched[]
  allCalls: CallLogEnriched[]
  leads: Lead[]
  isLoading: boolean
  onSelectCall: (call: CallLogEnriched) => void
}

function fmtUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}
function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

export function DirectorView({
  filteredCalls,
  allCalls,
  leads,
  isLoading,
  onSelectCall,
}: Props) {
  const { t } = useT()
  const period = useFiltersStore((s) => s.filters.period)
  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? period
  const confirmedRdvLeadKeys = useRdvStore((s) => s.confirmedRdvLeadKeys)
  const [threshold, setThreshold] = useState(60)

  const [panel, setPanel] = useState<{
    title: string
    calls: CallLogEnriched[]
    raw?: boolean
    rappelDate?: boolean
    summary?: boolean
  } | null>(null)
  const [handoffPanel, setHandoffPanel] = useState<
    ReturnType<typeof computeHandoffCandidates>[number] | null
  >(null)

  const kpis = useMemo(
    () => computeDirectorKpis(filteredCalls, threshold, confirmedRdvLeadKeys),
    [filteredCalls, threshold, confirmedRdvLeadKeys]
  )
  const qualCounts = useMemo(
    () => computeQualificationCounts(filteredCalls, confirmedRdvLeadKeys),
    [filteredCalls, confirmedRdvLeadKeys]
  )
  const phase = useMemo(() => computePhaseTracking(filteredCalls), [filteredCalls])
  const agents = useMemo(() => computeAgentBuckets(filteredCalls), [filteredCalls])

  const handoff = useMemo(
    () => computeHandoffCandidates(filteredCalls, leads),
    [filteredCalls, leads]
  )

  const openKpi = (id: KpiId, title: string) =>
    setPanel({ title, calls: callsForKpi(filteredCalls, id, threshold, confirmedRdvLeadKeys) })
  const openQual = (key: QualKey, title: string) =>
    setPanel({
      title,
      calls: callsForQualification(filteredCalls, key, confirmedRdvLeadKeys),
      // The RAPPEL card surfaces leads_rdv.rappel_rdv per row.
      rappelDate: key === 'rappel',
      // "À passer à l'humain" surfaces the call summary so the operator
      // knows immediately why the lead was flagged for handoff.
      summary: key === 'a_passer_a_humain',
    })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  const kpiCards: {
    id: string
    label: string
    value: string
    icon: typeof Phone
    color: string
    highlight?: boolean
  }[] = [
    { id: 'total', label: t('director.totalCalls'), value: kpis.totalCalls.toLocaleString(), icon: Phone, color: 'bg-blue-500/10 text-blue-500' },
    { id: 'answered', label: t('director.answered'), value: `${kpis.answered.toLocaleString()} · ${kpis.answeredPct.toFixed(0)}%`, icon: PhoneCall, color: 'bg-emerald-500/10 text-emerald-500' },
    { id: 'cost', label: t('director.costConsumed'), value: fmtUsd(kpis.cost), icon: DollarSign, color: 'bg-amber-500/10 text-amber-500' },
    { id: 'rdv', label: t('director.rdvConfirmed'), value: kpis.rdvConfirmed.toLocaleString(), icon: CalendarCheck, color: 'bg-emerald-500/10 text-emerald-500', highlight: true },
    { id: 'conversion', label: t('director.conversion'), value: `${kpis.conversionRate.toFixed(1)}%`, icon: TrendingUp, color: 'bg-violet-500/10 text-violet-500' },
    { id: 'avg', label: t('director.avgDuration'), value: fmtDur(kpis.avgDuration), icon: Clock, color: 'bg-cyan-500/10 text-cyan-500' },
    { id: 'callbacks', label: t('director.callbacks'), value: kpis.callbacks.toLocaleString(), icon: RotateCcw, color: 'bg-orange-500/10 text-orange-400' },
    { id: 'over', label: `${t('logs.col.duration')} > ${threshold}s`, value: kpis.callsOverThreshold.toLocaleString(), icon: Timer, color: 'bg-zinc-500/10 text-zinc-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('director.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('common.period')} : <span className="font-medium">{periodLabel}</span> ·{' '}
            {filteredCalls.length.toLocaleString()} {t('common.calls')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReportButton allCalls={allCalls} leads={leads} />
          <ApiStatus />
        </div>
      </div>

      {/* KPI banner */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <button
            key={k.id}
            onClick={() => openKpi(k.id as KpiId, k.label)}
            className="text-left"
          >
            <Card
              className={`py-4 transition-shadow hover:shadow-md ${
                k.highlight ? 'ring-1 ring-emerald-500/40' : ''
              }`}
            >
              <CardContent className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${k.color}`}>
                  <k.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-xl font-semibold">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* Threshold control for the "> Xs" KPI */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Timer className="h-4 w-4" />
        {t('director.thresholdLabel')}
        <Input
          type="number"
          value={threshold}
          min={1}
          onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 1))}
          className="h-8 w-24"
        />
        {t('director.thresholdUnit')}
        <span className="ml-1 flex gap-1">
          {[60, 120, 180, 300, 600].map((s) => (
            <button
              key={s}
              onClick={() => setThreshold(s)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                threshold === s
                  ? 'bg-primary text-primary-foreground'
                  : 'border hover:bg-muted'
              }`}
            >
              {s < 60 ? `${s}s` : `${s / 60}min`}
            </button>
          ))}
        </span>
      </div>

      {/* Totals consistency banner: Σ cards = total */}
      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              <span className="text-muted-foreground">{t('director.totals.total')} :</span>{' '}
              <span className="font-bold tabular-nums">
                {kpis.totalCalls.toLocaleString()}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">{t('director.totals.answered')} :</span>{' '}
              <span className="font-semibold tabular-nums text-emerald-500">
                {kpis.answered.toLocaleString()}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">{t('director.totals.notAnswered')} :</span>{' '}
              <span className="font-semibold tabular-nums text-zinc-400">
                {(kpis.totalCalls - kpis.answered).toLocaleString()}
              </span>
            </span>
          </div>
          {(() => {
            const sum = QUALIFICATION_CARDS.reduce(
              (s, k) => s + (qualCounts[k] ?? 0),
              0
            )
            const ok = sum === kpis.totalCalls
            return (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  ok
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-red-500/10 text-red-500'
                }`}
              >
                Σ cards = {sum.toLocaleString()} {ok ? '✓' : '⚠'}
              </span>
            )
          })()}
        </CardContent>
      </Card>

      {/* Qualification cards */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <CardTitle className="text-base">{t('director.qualifications')}</CardTitle>
              <CardDescription>
                {t('director.qualifications.desc')}
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">
                {filteredCalls.length.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t('director.callsLabel')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUALIFICATION_CARDS.map((key) => {
              const meta = QUAL_META[key]
              const count = qualCounts[key] ?? 0
              return (
                <button
                  key={key}
                  onClick={() => openQual(key, meta.label)}
                  className={`rounded-lg border border-l-4 bg-card p-4 text-left transition-shadow hover:shadow-md ${meta.cardAccent}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: meta.hex }}
                    />
                    <span className="text-2xl font-bold tabular-nums">
                      {count.toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{meta.label}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Appels entrants */}
      <InboundCallsPanel
        calls={filteredCalls}
        onSelectCall={onSelectCall}
        isLoading={isLoading}
      />

      {/* Phase tracking + Agents */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('director.phaseTracking')}</CardTitle>
            <CardDescription>{t('director.phase.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {phase.phases
                .filter((p) => p.phase !== 'Inconnu' || p.calls > 0)
                .map((p) => {
                  const max = Math.max(...phase.phases.map((x) => x.calls), 1)
                  return (
                    <div key={p.phase} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{p.phase}</span>
                        <span className="font-mono text-muted-foreground">
                          {p.leads.toLocaleString()} {t('director.phase.leads')} · {p.calls.toLocaleString()} {t('common.calls')}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded bg-muted">
                        <div
                          className="h-full bg-blue-500/60"
                          style={{ width: `${(p.calls / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className="border-t pt-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                {t('director.phase.bySlot')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {phase.creneaux.map((c) => (
                  <div
                    key={c.key}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="truncate">{c.label}</span>
                    <span className="font-mono font-semibold">{c.calls}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-500" /> {t('director.agentChain')}
            </CardTitle>
            <CardDescription>
              {t('director.agentChain.desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: t('director.agentChain.a1'), value: agents.agent1Only, bucket: 'a1' as const },
              { label: t('director.agentChain.a12'), value: agents.agent1And2, bucket: 'a12' as const },
              { label: t('director.agentChain.a123'), value: agents.agent1And2And3, bucket: 'a123' as const },
            ].map((row) => (
              <button
                key={row.bucket}
                onClick={() =>
                  setPanel({
                    title: row.label,
                    calls: callsForAgentBucket(filteredCalls, row.bucket),
                  })
                }
                className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <span className="text-sm">{row.label}</span>
                <span className="text-lg font-bold tabular-nums">
                  {row.value.toLocaleString()}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* #8 — Analyse des appels (fusion Duration + Verbatims) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('director.analysisTitle')}</CardTitle>
          <CardDescription>{t('director.analysisDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <DurationHistogram calls={filteredCalls} isLoading={false} />
            <VerbatimPanel calls={filteredCalls} isLoading={false} />
          </div>
        </CardContent>
      </Card>

      {/* Dossiers à confier */}
      <HandoffSection
        candidates={handoff}
        onOpenDetail={(c) => setHandoffPanel(c)}
      />

      <HandoffDetailSheet
        candidate={handoffPanel}
        allCalls={allCalls}
        open={!!handoffPanel}
        onOpenChange={(o) => !o && setHandoffPanel(null)}
      />

      {/* Click-through slide-over */}
      <DetailSlideOver
        open={!!panel}
        onOpenChange={(o) => !o && setPanel(null)}
        title={panel?.title ?? ''}
        calls={panel?.calls ?? []}
        showRaw={panel?.raw}
        showRappelDate={panel?.rappelDate}
        showSummary={panel?.summary}
        onSelectCall={(c) => {
          setPanel(null)
          onSelectCall(c)
        }}
      />
    </div>
  )
}

// ─── Dossiers à confier à un humain ─────────────────────────────────────────

function HandoffSection({
  candidates,
  onOpenDetail,
}: {
  candidates: ReturnType<typeof computeHandoffCandidates>
  onOpenDetail: (c: ReturnType<typeof computeHandoffCandidates>[number]) => void
}) {
  const { t } = useT()
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, string>>({})

  const assign = async (leadId: string, to: string, reason: string) => {
    setBusy(leadId + to)
    try {
      const res = await fetch('/api/dashboard/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, assignedTo: to, reason, assignedBy: 'dashboard' }),
      })
      if (res.ok) setDone((d) => ({ ...d, [leadId]: to }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-violet-500" />
          {t('director.handoff')}
        </CardTitle>
        <CardDescription>
          {t('director.handoff.desc')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('director.handoff.empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.slice(0, 25).map((c) => {
              const bmiText = formatBmi(c.bmi).text
              return (
                <div
                  key={c.leadId}
                  onClick={() => onOpenDetail(c)}
                  className="flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {c.name ?? t('director.handoff.unknown')}{' '}
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.phone ?? ''}
                      </span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.reasons.map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px]">
                          {r}
                        </Badge>
                      ))}
                      {formatBmi(c.bmi).valid && (
                        <Badge variant="outline" className="text-[10px]">
                          BMI {bmiText}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {done[c.leadId] ? (
                    <Badge className="bg-emerald-500 text-white">
                      {t('director.assign.assigned').replace('{to}', done[c.leadId])}
                    </Badge>
                  ) : (
                    <div
                      className="flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === c.leadId + 'Rain'}
                        onClick={() => assign(c.leadId, 'Rain', c.reasons.join(' ; '))}
                      >
                        {busy === c.leadId + 'Rain' && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        {t('director.assign.rain')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === c.leadId + 'Summer'}
                        onClick={() => assign(c.leadId, 'Summer', c.reasons.join(' ; '))}
                      >
                        {busy === c.leadId + 'Summer' && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        {t('director.assign.summer')}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
            {candidates.length > 25 && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                {t('director.othersMore').replace('{n}', String(candidates.length - 25))}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
