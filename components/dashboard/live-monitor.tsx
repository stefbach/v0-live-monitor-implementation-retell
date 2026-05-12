'use client'

import { useEffect, useState } from 'react'
import { Phone, PhoneIncoming, PhoneOutgoing, Radio, User, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useActiveCalls } from '@/lib/hooks/use-calls'
import { LiveCallSkeleton } from './skeleton-loaders'
import type { ActiveCallEnriched, Qualification } from '@/lib/types'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const QUALIF_STYLE: Record<string, string> = {
  'RDV MEDECIN': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  'NOUVEAU DOSSIER': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  'PAS INTERESSE': 'bg-red-500/10 text-red-400 border-red-500/30',
  'PAS DE REPONSE': 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  'FAUX NUMERO': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
}

function getQualifBadge(q: Qualification | null | undefined) {
  if (!q) return null
  const cls = QUALIF_STYLE[q] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
  return (
    <Badge variant="outline" className={cls}>
      {q}
    </Badge>
  )
}

function LiveCallCard({ call }: { call: ActiveCallEnriched }) {
  const [duration, setDuration] = useState(call.currentDuration)

  useEffect(() => {
    const startTime = new Date(call.startTime).getTime()
    const update = () => setDuration(Math.floor((Date.now() - startTime) / 1000))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [call.startTime])

  const lead = call.lead

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500">
        <div className="h-full w-full animate-pulse bg-emerald-400" />
      </div>

      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            {call.direction === 'inbound' ? (
              <PhoneIncoming className="h-6 w-6 text-emerald-500" />
            ) : (
              <PhoneOutgoing className="h-6 w-6 text-emerald-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate text-base">
                {lead?.nom || 'Unknown caller'}
              </p>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {call.direction === 'inbound' ? call.fromNumber : call.toNumber}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-1">
              Agent: <span className="text-foreground">{call.agentName}</span>
            </p>
          </div>

          <span className="font-mono text-emerald-500 font-semibold tabular-nums shrink-0">
            {formatDuration(duration)}
          </span>
        </div>

        {lead && (
          <div className="rounded-md bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Matched lead
              </span>
              {getQualifBadge(lead.qualification)}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">BMI</p>
                <p className="font-mono font-medium">{lead.bmi != null ? lead.bmi.toFixed(1) : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Source</p>
                <p className="truncate font-medium">{lead.source_lead ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Calls
                </p>
                <p className="font-mono font-medium">{lead.call_count ?? 0}</p>
              </div>
            </div>
            {lead.date_rdv && (
              <p className="text-xs text-emerald-500 font-medium">
                📅 RDV scheduled: {lead.date_rdv}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function LiveMonitor() {
  const { activeCalls, isLoading, isError, refresh } = useActiveCalls()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-500" />
              Live Calls
            </CardTitle>
            <CardDescription>Real-time active call monitoring</CardDescription>
          </CardHeader>
        </Card>
        {[...Array(2)].map((_, i) => (
          <LiveCallSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="border-red-500/20 bg-red-950/10">
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <Phone className="h-12 w-12 text-red-500/50" />
            <p className="mt-4 text-sm text-red-400">Failed to load active calls</p>
            <button
              onClick={() => refresh()}
              className="mt-2 text-sm text-red-400 underline hover:text-red-300"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-500" />
                Live Calls
                {activeCalls.length > 0 && (
                  <Badge className="bg-emerald-500 text-white ml-2">{activeCalls.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>Real-time active call monitoring · Patient context matched from CRM</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Auto-refreshing
            </div>
          </div>
        </CardHeader>
      </Card>

      {activeCalls.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Phone className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">No active calls</p>
              <p className="text-xs text-muted-foreground mt-1">
                Active calls will appear here in real-time
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {activeCalls.map((call) => (
            <LiveCallCard key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  )
}
