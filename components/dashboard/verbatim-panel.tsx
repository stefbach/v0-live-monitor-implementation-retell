'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Quote, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { extractVerbatims } from '@/lib/analytics'
import type { CallLogEnriched } from '@/lib/types'

interface Props {
  calls: CallLogEnriched[]
  isLoading?: boolean
}

const QUALIF_STYLE: Record<string, string> = {
  'RDV MEDECIN': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  'NOUVEAU DOSSIER': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  'PAS INTERESSE': 'bg-red-500/10 text-red-400 border-red-500/30',
  'PAS DE REPONSE': 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  'FAUX NUMERO': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  'FOLLOW UP': 'bg-violet-500/10 text-violet-400 border-violet-500/30',
}

export function VerbatimPanel({ calls, isLoading }: Props) {
  const [selected, setSelected] = useState<string | 'all'>('all')

  const allEntries = useMemo(() => extractVerbatims(calls), [calls])
  const qualifs = useMemo(() => {
    const set = new Set<string>()
    for (const e of allEntries) if (e.qualification) set.add(e.qualification)
    return [...set]
  }, [allEntries])

  const filtered = useMemo(
    () =>
      selected === 'all'
        ? allEntries
        : allEntries.filter((e) => e.qualification === selected),
    [allEntries, selected]
  )

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verbatims</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-violet-500" />
          What they said
        </CardTitle>
        <CardDescription>
          Call summaries grouped by qualification — spot recurring objections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSelected('all')}
            className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
              selected === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({allEntries.length})
          </button>
          {qualifs.map((q) => {
            const count = allEntries.filter((e) => e.qualification === q).length
            return (
              <button
                key={q}
                onClick={() => setSelected(q)}
                className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                  selected === q
                    ? 'bg-primary text-primary-foreground border-primary'
                    : QUALIF_STYLE[q] ?? 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {q} ({count})
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No summaries match.</p>
        ) : (
          <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {filtered.slice(0, 30).map((e) => (
              <li key={e.callId} className="rounded-md border border-border/50 bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-medium text-sm truncate">
                      {e.leadName ?? 'Unknown'}
                    </span>
                    {e.qualification && (
                      <Badge
                        variant="outline"
                        className={QUALIF_STYLE[e.qualification] ?? 'text-muted-foreground'}
                      >
                        {e.qualification}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                    {e.startTime ? format(new Date(e.startTime), 'MMM d, HH:mm') : ''}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground flex gap-2">
                  <Quote className="h-3 w-3 mt-1 shrink-0 text-muted-foreground/50" />
                  <span>{e.summary}</span>
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {e.agentName} · {Math.floor(e.duration / 60)}:
                  {(e.duration % 60).toString().padStart(2, '0')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
