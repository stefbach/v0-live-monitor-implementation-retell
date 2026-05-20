'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  AlertTriangle,
  Voicemail,
  Bot,
  Bug,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardErrors } from '@/lib/hooks/use-dashboard'
import { DirectionIcon } from '../direction-indicator'
import { AnomalyDetailSheet } from './anomaly-detail-sheet'
import type { Lead } from '@/lib/types'
import type { Anomaly } from '@/lib/live-alerts'
import {
  computeRepondeurs,
  computeRobotLeads,
  computeAnomalies,
} from '@/lib/live-alerts'
import type { CallLogEnriched } from '@/lib/types'

interface Props {
  allCalls: CallLogEnriched[]
  leads: Lead[]
}

export function ErrorsView({ allCalls, leads }: Props) {
  const { errors, isLoading, refresh } = useDashboardErrors()
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [resolving, setResolving] = useState<string | null>(null)
  const [calledBack, setCalledBack] = useState<Set<string>>(new Set())
  const [anomalyPanel, setAnomalyPanel] = useState<Anomaly | null>(null)

  const repondeurs = useMemo(() => computeRepondeurs(allCalls), [allCalls])
  const robotLeads = useMemo(() => computeRobotLeads(allCalls), [allCalls])
  const anomalies = useMemo(() => computeAnomalies(allCalls), [allCalls])

  const errorTypes = useMemo(
    () => [...new Set(errors.map((e) => e.error_type))],
    [errors]
  )
  const filteredErrors = errors.filter((e) => {
    if (typeFilter !== 'all' && e.error_type !== typeFilter) return false
    if (dateFilter && (e.created_at ?? '').slice(0, 10) !== dateFilter) return false
    return true
  })

  const resolve = async (id: string) => {
    setResolving(id)
    try {
      await fetch('/api/dashboard/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', id }),
      })
      await refresh()
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Log des erreurs système */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bug className="h-4 w-4 text-red-500" />
                Log des erreurs système
              </CardTitle>
              <CardDescription>Table dashboard_errors (Supabase)</CardDescription>
            </div>
            <div className="flex gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                <option value="all">Tous les types</option>
                {errorTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-8 w-40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : filteredErrors.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune erreur enregistrée. 👍
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Lead / Call</th>
                    <th className="pb-2 font-medium">Détail</th>
                    <th className="pb-2 font-medium">Statut</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredErrors.map((e) => (
                    <tr key={e.id} className="border-b border-border/40">
                      <td className="py-2 text-xs">
                        {e.created_at
                          ? format(new Date(e.created_at), 'dd/MM HH:mm')
                          : '—'}
                      </td>
                      <td className="py-2">
                        <Badge variant="outline">{e.error_type}</Badge>
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">
                        {e.lead_id?.slice(0, 8) ?? e.call_id?.slice(0, 8) ?? '—'}
                      </td>
                      <td className="py-2 max-w-[280px] truncate text-xs">
                        {e.detail ?? '—'}
                      </td>
                      <td className="py-2">
                        {e.status === 'resolved' ? (
                          <Badge className="bg-emerald-500 text-white">Résolu</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-500">
                            En cours
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {e.status !== 'resolved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={resolving === e.id}
                            onClick={() => resolve(e.id)}
                          >
                            {resolving === e.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Résoudre'
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Répondeurs à rappeler */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Voicemail className="h-4 w-4 text-amber-500" />
              Répondeurs à rappeler ({repondeurs.length})
            </CardTitle>
            <CardDescription>
              Répondeur détecté ou appel très court suspect
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[360px] space-y-2 overflow-y-auto">
              {repondeurs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucun répondeur à rappeler.
                </p>
              ) : (
                repondeurs.slice(0, 60).map((r) => {
                  const done = calledBack.has(r.callId)
                  return (
                    <div
                      key={r.callId}
                      className="flex items-center justify-between gap-2 rounded-md border p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          <DirectionIcon direction={r.direction} size="sm" />
                          {r.name ?? 'Inconnu'}{' '}
                          <span className="font-mono text-xs text-muted-foreground">
                            {r.phone}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.duration}s ·{' '}
                          {r.inVoicemail ? 'voicemail confirmé' : 'suspecté'} ·{' '}
                          {r.time ? format(new Date(r.time), 'dd/MM HH:mm') : ''}
                        </p>
                      </div>
                      {done ? (
                        <Badge className="bg-emerald-500 text-white shrink-0">
                          Rappelé
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() =>
                            setCalledBack((s) => new Set(s).add(r.callId))
                          }
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Marquer rappelé
                        </Button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Robot awareness */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-red-500" />
              Robot awareness ({robotLeads.length})
            </CardTitle>
            <CardDescription>
              Le prospect a réalisé qu&apos;il parlait à une IA → confier à un humain
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[360px] space-y-2 overflow-y-auto">
              {robotLeads.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucun cas détecté.
                </p>
              ) : (
                robotLeads.slice(0, 60).map((r) => (
                  <div
                    key={r.callId}
                    className="flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-950/10 p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <DirectionIcon direction={r.direction} size="sm" />
                        {r.name ?? 'Inconnu'}{' '}
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.phone}
                        </span>
                      </p>
                      <p className="text-[11px] text-red-300">
                        Recommandation : rappel humain prioritaire
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                      {r.time ? format(new Date(r.time), 'dd/MM HH:mm') : ''}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Anomalies ({anomalies.length})
          </CardTitle>
          <CardDescription>
            Numéros jamais joints · leads à 3 tentatives sans contact
          </CardDescription>
        </CardHeader>
        <CardContent>
          {anomalies.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune anomalie. 👍
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {anomalies.slice(0, 40).map((a) => (
                <button
                  key={a.kind + a.key}
                  onClick={() => setAnomalyPanel(a)}
                  className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-left text-sm transition-shadow hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{a.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.detail}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    ×{a.count}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AnomalyDetailSheet
        anomaly={anomalyPanel}
        allCalls={allCalls}
        leads={leads}
        open={!!anomalyPanel}
        onOpenChange={(o) => !o && setAnomalyPanel(null)}
      />
    </div>
  )
}
