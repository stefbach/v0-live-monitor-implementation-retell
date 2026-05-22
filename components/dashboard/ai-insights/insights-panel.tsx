'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Lightbulb,
  Flame,
  Quote,
  TrendingUp,
  MessageSquare,
  Smile,
  Meh,
  Frown,
  PhoneCall,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useInsights } from '@/lib/hooks/use-insights'
import { useFiltersStore } from '@/lib/stores/filters-store'
import { PERIODS } from '@/lib/filters'
import { CallDetailSheet } from '@/components/dashboard/call-detail-sheet'
import type { CallLogEnriched } from '@/lib/types'
import type {
  InsightsResult,
  StrategicAlert,
  ObjectionInsight,
  HotLead,
} from '@/lib/insights/types'

interface Props {
  filteredCalls: CallLogEnriched[]
}

function periodLabel(period: string): string {
  return PERIODS.find((p) => p.id === period)?.label ?? period
}

export function InsightsPanel({ filteredCalls }: Props) {
  const filters = useFiltersStore((s) => s.filters)
  const [enabled, setEnabled] = useState(false)
  const [openCallId, setOpenCallId] = useState<string | null>(null)
  const label = periodLabel(filters.period)

  const callsWithSummary = useMemo(
    () => filteredCalls.filter((c) => c.summary && c.summary.length > 10),
    [filteredCalls]
  )

  const { insights, isLoading, isError, refresh, inputCount, fromLocalCache } = useInsights({
    filteredCalls,
    periodLabel: label,
    enabled,
  })

  // Build a call_id → call map for resolving "hot lead" references
  const callsById = useMemo(() => {
    const m = new Map<string, CallLogEnriched>()
    for (const c of filteredCalls) m.set(c.callId, c)
    return m
  }, [filteredCalls])

  if (!enabled && !insights) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI Insights — analyse stratégique
          </CardTitle>
          <CardDescription>
            Génère un résumé exécutif, les objections fréquentes, les tendances émergentes, un
            audit du script et le climat de la période. Analyse réalisée par DeepSeek V3 sur
            les résumés Retell.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <p className="text-muted-foreground">
              <strong>Période</strong> : {label} ·{' '}
              <strong>{filteredCalls.length.toLocaleString()}</strong> appels filtrés ·{' '}
              <strong>{callsWithSummary.length.toLocaleString()}</strong> avec résumé exploitable
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ~10–20 secondes de génération · coût estimé ~0,02–0,05 $ selon volume
            </p>
          </div>
          <Button
            onClick={() => setEnabled(true)}
            disabled={filteredCalls.length === 0}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Générer les insights
          </Button>
          {filteredCalls.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Aucun appel à analyser — élargis tes filtres.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className="border-red-500/30 bg-red-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Échec de la génération
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-red-300">{isError.message}</p>
          <Button onClick={() => refresh()} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Réessayer
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !insights) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-500 animate-pulse" />
              Analyse en cours…
            </CardTitle>
            <CardDescription>
              DeepSeek analyse {inputCount.toLocaleString()} appels — patientez 10 à 20 secondes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <InsightsHeader
        insights={insights}
        onRefresh={() => refresh()}
        loading={isLoading}
        fromLocalCache={fromLocalCache}
      />

      {(insights.strategic_alerts ?? []).length > 0 && (
        <StrategicAlerts alerts={insights.strategic_alerts ?? []} />
      )}

      <ExecutivePulse insights={insights} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ObjectionTracker objections={insights.objections ?? []} callsById={callsById} />
        <TrendSpotting trends={insights.trends} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScriptAudit audit={insights.script_audit} callsById={callsById} />
        <SentimentClimate
          sentiment={insights.sentiment}
          callsById={callsById}
          onSelectCallId={setOpenCallId}
        />
      </div>

      {(insights.optimization_hypotheses ?? []).length > 0 && (
        <OptimizationHypotheses hypotheses={insights.optimization_hypotheses ?? []} />
      )}

      <p className="text-[10px] text-muted-foreground italic text-center">
        ⚠️ Les suggestions de l&apos;IA sont des hypothèses à valider, pas des vérités. Les
        chiffres décrivent les données observées — ils ne prédisent pas l&apos;impact d&apos;un
        changement.
      </p>

      <CallDetailSheet
        callId={openCallId}
        open={!!openCallId}
        onOpenChange={(o) => !o && setOpenCallId(null)}
        allCalls={filteredCalls}
      />
    </div>
  )
}

// ─── Header ─────────────────────────────────────────────────────────────────

function InsightsHeader({
  insights,
  onRefresh,
  loading,
  fromLocalCache,
}: {
  insights: InsightsResult
  onRefresh: () => void
  loading: boolean
  fromLocalCache: boolean
}) {
  const generated = new Date(insights.meta.generated_at)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/10 text-violet-500">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">AI Insights · {insights.meta.period_label}</p>
          <p className="text-xs text-muted-foreground truncate">
            Généré {format(generated, 'HH:mm:ss')} ·{' '}
            {insights.meta.calls_analysed.toLocaleString()} appels ·{' '}
            {(insights.meta.elapsed_ms / 1000).toFixed(1)}s · {insights.meta.model}
            {fromLocalCache && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                💾 cache local
              </Badge>
            )}
            {insights.meta.cached && !fromLocalCache && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                cached
              </Badge>
            )}
          </p>
        </div>
      </div>
      <Button onClick={onRefresh} size="sm" variant="outline" disabled={loading} className="gap-2">
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        Re-générer
      </Button>
    </div>
  )
}

// ─── Strategic Alerts ──────────────────────────────────────────────────────

function StrategicAlerts({ alerts }: { alerts: StrategicAlert[] }) {
  const sev = (s: string) =>
    s === 'high'
      ? 'border-red-500/40 bg-red-950/20 text-red-300'
      : s === 'medium'
        ? 'border-amber-500/40 bg-amber-950/20 text-amber-300'
        : 'border-blue-500/30 bg-blue-950/10 text-blue-300'
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className={`flex items-start gap-3 rounded-md border p-3 ${sev(a.severity)}`}>
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{a.message}</p>
            <p className="text-[11px] opacity-75 mt-0.5">
              {a.evidence_count} appels supportent ce signal · sévérité {a.severity}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Executive Pulse ────────────────────────────────────────────────────────

function ExecutivePulse({ insights }: { insights: InsightsResult }) {
  return (
    <Card className="ring-1 ring-violet-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Pulse de la période
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed">{insights.pulse?.summary ?? ''}</p>
        {(insights.pulse?.highlights ?? []).length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 pt-2">
            {(insights.pulse?.highlights ?? []).map((h, i) => (
              <div key={i} className="rounded-md bg-muted/40 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                  {h.label}
                </p>
                <p className="text-sm font-semibold truncate">{h.value}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Objection Tracker ──────────────────────────────────────────────────────

function ObjectionTracker({
  objections,
  callsById,
}: {
  objections: ObjectionInsight[]
  callsById: Map<string, CallLogEnriched>
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Quote className="h-4 w-4 text-red-500" />
          Top objections
        </CardTitle>
        <CardDescription>Pourquoi les prospects refusent (avec suggestions à valider)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(objections ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune objection saillante détectée.</p>
        ) : (
          objections.map((o, i) => {
            const max = Math.max(...objections.map((x) => x.count ?? 0), 1)
            const calls = o.example_call_ids ?? []
            return (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{o.label}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {o.count ?? 0} · {(o.percent ?? 0).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-red-500/60"
                    style={{ width: `${((o.count ?? 0) / max) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground italic">
                  💡 <strong>Suggestion à valider</strong> : {o.counter_argument}
                </p>
                {calls.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {calls.slice(0, 3).map((cid) => {
                      const c = callsById.get(cid)
                      return (
                        <Badge key={cid} variant="outline" className="text-[10px] font-mono">
                          {c?.lead?.nom ?? cid.slice(0, 8)}
                        </Badge>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

// ─── Trend Spotting ─────────────────────────────────────────────────────────

function TrendSpotting({
  trends,
}: {
  trends: InsightsResult['trends']
}) {
  const keywords = trends?.emerging_keywords ?? []
  const signals = trends?.weak_signals ?? []
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-cyan-500" />
          Tendances & signaux faibles
        </CardTitle>
        <CardDescription>Sujets qui émergent dans les conversations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {keywords.length === 0 && signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune tendance saillante.</p>
        ) : (
          <>
            {keywords.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                  Mots-clés émergents
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((k, i) => (
                    <div
                      key={i}
                      title={k.note}
                      className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs border border-cyan-500/30"
                    >
                      <span className="font-medium">{k.keyword}</span>
                      <span className="text-cyan-400 ml-1 font-mono">×{k.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {signals.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 mt-3">
                  Signaux faibles
                </p>
                <ul className="space-y-1.5 text-sm">
                  {signals.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground">·</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Script Audit ───────────────────────────────────────────────────────────

function ScriptAudit({
  audit,
  callsById,
}: {
  audit: InsightsResult['script_audit']
  callsById: Map<string, CallLogEnriched>
}) {
  const topics = audit?.common_hangup_topics ?? []
  const patterns = audit?.converted_call_patterns ?? []
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-amber-500" />
          Audit du script
        </CardTitle>
        <CardDescription>
          Thèmes de raccrochage + phrases sur-représentées dans les appels gagnés
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {topics.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
              Au moment du raccrochage…
            </p>
            <ul className="space-y-1.5 text-sm">
              {topics.map((t, i) => (
                <li key={i} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p>{t.topic}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(t.example_call_ids ?? []).slice(0, 3).map((cid) => (
                        <Badge key={cid} variant="outline" className="text-[10px] font-mono">
                          {callsById.get(cid)?.lead?.nom ?? cid.slice(0, 8)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">×{t.count ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {patterns.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-emerald-500 mb-2">
              Sur-représenté dans les RDV obtenus
            </p>
            <ul className="space-y-1.5 text-sm">
              {patterns.map((p, i) => (
                <li key={i} className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-2">
                  <p className="font-medium">{p.phrase_or_theme}</p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {p.frequency_in_won ?? 0}× dans les gagnés · {p.frequency_in_lost ?? 0}× dans les perdus
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {topics.length === 0 && patterns.length === 0 && (
          <p className="text-sm text-muted-foreground">Données insuffisantes pour cet audit.</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Sentiment Climate ──────────────────────────────────────────────────────

function SentimentClimate({
  sentiment,
  callsById,
  onSelectCallId,
}: {
  sentiment: InsightsResult['sentiment']
  callsById: Map<string, CallLogEnriched>
  onSelectCallId: (id: string) => void
}) {
  const dist = sentiment?.distribution ?? { positive: 0, neutral: 0, negative: 0 }
  const hotLeads = sentiment?.hot_leads ?? []
  const score = sentiment?.average_score ?? 0
  const total = (dist.positive ?? 0) + (dist.neutral ?? 0) + (dist.negative ?? 0)
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-amber-500" />
          Climat & hot leads
        </CardTitle>
        <CardDescription>Score moyen + 5 prospects à rappeler en priorité</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score gauge */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums">
              {score.toFixed(1)}
              <span className="text-sm text-muted-foreground font-normal">/10</span>
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Score moyen
            </p>
          </div>
          <div className="flex-1 space-y-1.5">
            <SentimentBar
              icon={<Smile className="h-3 w-3 text-emerald-500" />}
              label="Positif"
              n={dist.positive ?? 0}
              pct={pct(dist.positive ?? 0)}
              color="bg-emerald-500/70"
            />
            <SentimentBar
              icon={<Meh className="h-3 w-3 text-blue-500" />}
              label="Neutre"
              n={dist.neutral ?? 0}
              pct={pct(dist.neutral ?? 0)}
              color="bg-blue-500/70"
            />
            <SentimentBar
              icon={<Frown className="h-3 w-3 text-rose-500" />}
              label="Négatif"
              n={dist.negative ?? 0}
              pct={pct(dist.negative ?? 0)}
              color="bg-rose-500/70"
            />
          </div>
        </div>

        {/* Hot leads */}
        {hotLeads.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <PhoneCall className="h-3 w-3" /> Hot leads à rappeler humainement
            </p>
            <ul className="space-y-1.5">
              {hotLeads.map((hl: HotLead) => {
                const c = callsById.get(hl.call_id)
                return (
                  <li key={hl.call_id}>
                    <button
                      type="button"
                      onClick={() => onSelectCallId(c?.id ?? hl.call_id)}
                      className="w-full rounded-md border border-border/50 bg-muted/20 p-2 text-left transition-colors hover:bg-muted/40"
                    >
                      <p className="text-sm font-medium truncate">
                        {c?.lead?.nom ?? `Call ${hl.call_id.slice(0, 8)}`}
                        {c?.lead?.numero_telephone && (
                          <span className="text-xs text-muted-foreground font-mono ml-2">
                            {c.lead.numero_telephone}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{hl.reason}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SentimentBar({
  icon,
  label,
  n,
  pct,
  color,
}: {
  icon: React.ReactNode
  label: string
  n: number
  pct: number
  color: string
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className="text-muted-foreground font-mono">
          {n} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Optimization Hypotheses ────────────────────────────────────────────────

function OptimizationHypotheses({
  hypotheses,
}: {
  hypotheses: InsightsResult['optimization_hypotheses']
}) {
  return (
    <Card className="border-violet-500/30 bg-violet-950/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-violet-500" />
          Hypothèses à tester
        </CardTitle>
        <CardDescription>
          Pistes d&apos;optimisation basées sur les données — à valider par A/B test, jamais à
          prendre pour vérité.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hypotheses.map((h, i) => (
          <div key={i} className="rounded-md bg-background/60 border p-3 space-y-1.5">
            <p className="text-sm">
              <strong className="text-violet-400">Observation :</strong> {h.observation}
            </p>
            <p className="text-sm">
              <strong className="text-emerald-400">Test à mener :</strong> {h.test_to_run}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
