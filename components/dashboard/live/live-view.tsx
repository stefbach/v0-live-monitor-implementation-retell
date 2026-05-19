'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Terminal, Siren } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LiveMonitor } from '@/components/dashboard/live-monitor'
import { recentFeed, computeLiveAlerts, type AlertLevel } from '@/lib/live-alerts'
import { QUAL_META, qualKeyFromRaw } from '@/lib/qualifications'
import type { CallLogEnriched } from '@/lib/types'

interface Props {
  allCalls: CallLogEnriched[]
}

const LEVEL_STYLE: Record<AlertLevel, string> = {
  rouge: 'border-red-500/40 bg-red-950/20 text-red-300',
  orange: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
  jaune: 'border-yellow-500/40 bg-yellow-950/15 text-yellow-300',
}

export function LiveView({ allCalls }: Props) {
  const feed = useMemo(() => recentFeed(allCalls, 40), [allCalls])
  const alerts = useMemo(() => computeLiveAlerts(allCalls, 30), [allCalls])
  const feedEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [feed])

  return (
    <div className="space-y-4">
      {/* Appels en cours (composant existant) */}
      <LiveMonitor />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Flux terminal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4 text-emerald-500" />
              Flux des appels terminés
            </CardTitle>
            <CardDescription>Derniers appels, plus récent en bas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] overflow-y-auto rounded-md bg-zinc-950 p-3 font-mono text-xs">
              {feed.length === 0 ? (
                <p className="text-zinc-500">En attente d&apos;appels…</p>
              ) : (
                [...feed].reverse().map((l) => {
                  const meta = QUAL_META[qualKeyFromRaw(l.qualification)]
                  return (
                    <div key={l.callId} className="flex gap-2 py-0.5">
                      <span className="text-zinc-500">[{l.time}]</span>
                      <span className="text-zinc-300">{l.name}</span>
                      <span className="text-zinc-600">—</span>
                      <span
                        className={meta.badgeClass
                          .replace(/bg-[^ ]+/g, '')
                          .replace(/border-[^ ]+/g, '')
                          .trim()}
                      >
                        {l.qualification}
                      </span>
                      <span className="text-zinc-600">—</span>
                      <span className="text-zinc-400">{l.duration}s</span>
                      <span className="text-zinc-600">—</span>
                      <span className="text-zinc-500 truncate">{l.agent}</span>
                    </div>
                  )
                })
              )}
              <div ref={feedEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* Alertes temps réel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Siren className="h-4 w-4 text-red-500" />
              Alertes temps réel
            </CardTitle>
            <CardDescription>
              Robot awareness · répondeur non détecté · appel anormalement court
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] space-y-2 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aucune alerte récente. 👍
                </p>
              ) : (
                alerts.map((a, i) => (
                  <div
                    key={a.callId + i}
                    className={`flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm ${LEVEL_STYLE[a.level]}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{a.label}</p>
                      <p className="truncate text-xs opacity-75">{a.name}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                      {a.time}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
