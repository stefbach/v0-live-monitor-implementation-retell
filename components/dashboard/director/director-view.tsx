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
import { PERIODS } from '@/lib/filters'
import type { CallLogEnriched, Lead } from '@/lib/types'

interface Props {
  filteredCalls: CallLogEnriched[]
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

export function DirectorView({ filteredCalls, leads, isLoading, onSelectCall }: Props) {
  const period = useFiltersStore((s) => s.filters.period)
  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? period
  const [threshold, setThreshold] = useState(60)

  const [panel, setPanel] = useState<{
    title: string
    calls: CallLogEnriched[]
  } | null>(null)

  const kpis = useMemo(
    () => computeDirectorKpis(filteredCalls, threshold),
    [filteredCalls, threshold]
  )
  const qualCounts = useMemo(
    () => computeQualificationCounts(filteredCalls),
    [filteredCalls]
  )
  const phase = useMemo(() => computePhaseTracking(filteredCalls), [filteredCalls])
  const agents = useMemo(() => computeAgentBuckets(filteredCalls), [filteredCalls])
  const handoff = useMemo(
    () => computeHandoffCandidates(filteredCalls, leads),
    [filteredCalls, leads]
  )

  const openKpi = (id: KpiId, title: string) =>
    setPanel({ title, calls: callsForKpi(filteredCalls, id, threshold) })
  const openQual = (key: QualKey, title: string) =>
    setPanel({ title, calls: callsForQualification(filteredCalls, key) })

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

  const kpiCards = [
    { id: 'total' as KpiId, label: 'Total appels', value: kpis.totalCalls.toLocaleString(), icon: Phone, color: 'bg-blue-500/10 text-blue-500' },
    { id: 'answered' as KpiId, label: 'Décrochés', value: `${kpis.answered.toLocaleString()} · ${kpis.answeredPct.toFixed(0)}%`, icon: PhoneCall, color: 'bg-emerald-500/10 text-emerald-500' },
    { id: 'cost' as KpiId, label: 'Coût consommé', value: fmtUsd(kpis.cost), icon: DollarSign, color: 'bg-amber-500/10 text-amber-500' },
    { id: 'rdv' as KpiId, label: 'RDV confirmés', value: kpis.rdvConfirmed.toLocaleString(), icon: CalendarCheck, color: 'bg-emerald-500/10 text-emerald-500', highlight: true },
    { id: 'conversion' as KpiId, label: 'Taux de conversion', value: `${kpis.conversionRate.toFixed(1)}%`, icon: TrendingUp, color: 'bg-violet-500/10 text-violet-500' },
    { id: 'avg' as KpiId, label: 'Durée moyenne (TMMC)', value: fmtDur(kpis.avgDuration), icon: Clock, color: 'bg-cyan-500/10 text-cyan-500' },
    { id: 'callbacks' as KpiId, label: 'Callbacks demandés', value: kpis.callbacks.toLocaleString(), icon: RotateCcw, color: 'bg-orange-500/10 text-orange-400' },
    { id: 'over' as KpiId, label: `Appels > ${threshold}s`, value: kpis.callsOverThreshold.toLocaleString(), icon: Timer, color: 'bg-zinc-500/10 text-zinc-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Vue d&apos;ensemble</h2>
          <p className="text-sm text-muted-foreground">
            Période : <span className="font-medium">{periodLabel}</span> ·{' '}
            {filteredCalls.length.toLocaleString()} appels
          </p>
        </div>
        <ApiStatus />
      </div>

      {/* KPI banner */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <button
            key={k.id}
            onClick={() => openKpi(k.id, k.label)}
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
        Seuil « appels longs » :
        <Input
          type="number"
          value={threshold}
          min={1}
          onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 1))}
          className="h-8 w-24"
        />
        secondes
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

      {/* Qualification cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Qualifications</CardTitle>
          <CardDescription>
            État CRM actuel des leads · clique une card pour voir les appels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    <span className={`h-2.5 w-2.5 rounded-sm ${meta.dotClass}`} />
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

      {/* Phase tracking + Agents */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Suivi J1 / J3 / J5</CardTitle>
            <CardDescription>Volume par phase et par créneau d&apos;appel UK</CardDescription>
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
                          {p.leads.toLocaleString()} leads · {p.calls.toLocaleString()} appels
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
                Par créneau
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
              <Users className="h-4 w-4 text-cyan-500" /> Chaîne d&apos;agents
            </CardTitle>
            <CardDescription>
              Combien de leads sont passés sur 1, 2 ou 3 agents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Agent 1 uniquement (Charlotte)', value: agents.agent1Only, bucket: 'a1' as const },
              { label: 'Agent 1 + 2 (→ Isabelle)', value: agents.agent1And2, bucket: 'a12' as const },
              { label: 'Agent 1 + 2 + 3 (→ Victoria)', value: agents.agent1And2And3, bucket: 'a123' as const },
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

      {/* Dossiers à confier */}
      <HandoffSection candidates={handoff} />

      {/* Click-through slide-over */}
      <DetailSlideOver
        open={!!panel}
        onOpenChange={(o) => !o && setPanel(null)}
        title={panel?.title ?? ''}
        calls={panel?.calls ?? []}
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
}: {
  candidates: ReturnType<typeof computeHandoffCandidates>
}) {
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
          Dossiers à confier à un humain
        </CardTitle>
        <CardDescription>
          Leads difficiles : éligible non abouti, robot awareness, tentatives échouées
        </CardDescription>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun dossier à confier sur cette période. 👍
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.slice(0, 25).map((c) => (
              <div
                key={c.leadId}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {c.name ?? 'Inconnu'}{' '}
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
                    {c.bmi != null && (
                      <Badge variant="outline" className="text-[10px]">
                        BMI {c.bmi.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                </div>
                {done[c.leadId] ? (
                  <Badge className="bg-emerald-500 text-white">
                    Assigné à {done[c.leadId]}
                  </Badge>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === c.leadId + 'Rain'}
                      onClick={() => assign(c.leadId, 'Rain', c.reasons.join(' ; '))}
                    >
                      {busy === c.leadId + 'Rain' && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      Assigner à Rain
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
                      Assigner à Summer
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {candidates.length > 25 && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                + {candidates.length - 25} autres dossiers
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
