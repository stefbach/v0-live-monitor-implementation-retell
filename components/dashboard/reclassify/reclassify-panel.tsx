'use client'

import { useMemo, useState } from 'react'
import { Loader2, Sparkles, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/lib/hooks/use-t'
import { QUAL_META, qualKeyFromRaw } from '@/lib/qualifications'
import type { CallLogEnriched } from '@/lib/types'

interface ReclassifyResult {
  callId: string
  retellOutcome: string | null
  supabaseQualification: string | null
  claudeSuggestion: string
  leadId: string | null
}

interface Props {
  filteredCalls: CallLogEnriched[]
  onRefresh: () => Promise<unknown>
}

const SUGGESTION_TO_RAW: Record<string, string> = {
  'RDV CONFIRME': 'RDV MEDECIN',
  "À PASSER À L'HUMAIN": "À PASSER À L'HUMAIN",
  RAPPEL: 'RAPPEL',
  'PAS INTERESSE': 'PAS INTERESSE',
  'PAS DE REPONSE': 'PAS DE REPONSE',
  REPONDEUR: 'REPONDEUR',
  'FAUX NUMERO': 'FAUX NUMERO',
  'NON ELIGIBLE': 'NON ELIGIBLE',
  'NE PAS RAPPELER': 'NE PAS RAPPELER',
}

export function ReclassifyPanel({ filteredCalls, onRefresh }: Props) {
  const { t } = useT()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ReclassifyResult[]>([])
  const [busyApplyId, setBusyApplyId] = useState<string | null>(null)
  const [applied, setApplied] = useState<Record<string, string>>({})

  // Take the most recent 30 calls in the filtered scope
  const sample = useMemo(
    () =>
      [...filteredCalls]
        .sort(
          (a, b) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )
        .slice(0, 30),
    [filteredCalls]
  )

  const run = async () => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/reclassify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callIds: sample.map((c) => c.callId) }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Erreur ${res.status}`)
      }
      const json = (await res.json()) as { data: ReclassifyResult[] }
      setResults(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const apply = async (r: ReclassifyResult) => {
    if (!r.leadId) return
    setBusyApplyId(r.callId)
    try {
      const raw = SUGGESTION_TO_RAW[r.claudeSuggestion] ?? r.claudeSuggestion
      const res = await fetch(
        `/api/leads/${encodeURIComponent(r.leadId)}/qualification`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qualification: raw }),
        }
      )
      if (res.ok) {
        setApplied((m) => ({ ...m, [r.callId]: r.claudeSuggestion }))
        await onRefresh()
      } else {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setError(body?.error ?? `Erreur ${res.status}`)
      }
    } finally {
      setBusyApplyId(null)
    }
  }

  const diffs = useMemo(() => {
    return results.filter(
      (r) =>
        qualKeyFromRaw(r.supabaseQualification) !==
        qualKeyFromRaw(SUGGESTION_TO_RAW[r.claudeSuggestion])
    )
  }, [results])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          {t('reclassify.title')}
        </CardTitle>
        <CardDescription>{t('reclassify.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t('reclassify.scope').replace('{n}', String(sample.length))}
          </p>
          <Button onClick={run} disabled={isAnalyzing || sample.length === 0}>
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('reclassify.analyzing')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {t('reclassify.analyze')}
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {results.length > 0 && (
          <>
            <p className="text-sm">
              <span className="font-semibold">{diffs.length}</span>{' '}
              {t('reclassify.diffs')}{' '}
              <span className="text-muted-foreground">
                / {results.length} {t('reclassify.totalAnalyzed')}
              </span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium">Call</th>
                    <th className="py-2 font-medium">{t('reclassify.col.retell')}</th>
                    <th className="py-2 font-medium">{t('reclassify.col.supabase')}</th>
                    <th className="py-2 font-medium">{t('reclassify.col.claude')}</th>
                    <th className="py-2 font-medium text-right">{t('reclassify.col.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const sbKey = qualKeyFromRaw(r.supabaseQualification)
                    const cKey = qualKeyFromRaw(
                      SUGGESTION_TO_RAW[r.claudeSuggestion] ?? r.claudeSuggestion
                    )
                    const differs = sbKey !== cKey
                    const wasApplied = applied[r.callId]
                    return (
                      <tr
                        key={r.callId}
                        className={`border-b border-border/50 ${
                          differs ? '' : 'opacity-50'
                        }`}
                      >
                        <td className="py-2 font-mono text-xs">
                          {r.callId.slice(0, 12)}…
                        </td>
                        <td className="py-2 text-xs">
                          {r.retellOutcome ?? '—'}
                        </td>
                        <td className="py-2">
                          <Badge
                            variant="outline"
                            className={QUAL_META[sbKey].badgeClass}
                          >
                            {QUAL_META[sbKey].label}
                          </Badge>
                        </td>
                        <td className="py-2">
                          <Badge
                            variant="outline"
                            className={QUAL_META[cKey].badgeClass}
                          >
                            {QUAL_META[cKey].label}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          {wasApplied ? (
                            <Badge className="bg-emerald-500 text-white">
                              <Check className="mr-1 h-3 w-3" />
                              {t('reclassify.applied')}
                            </Badge>
                          ) : differs && r.leadId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyApplyId === r.callId}
                              onClick={() => apply(r)}
                            >
                              {busyApplyId === r.callId && (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              )}
                              {t('reclassify.apply')}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {results.length === 0 && !isAnalyzing && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('reclassify.empty')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
