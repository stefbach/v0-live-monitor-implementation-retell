'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  User,
  Phone,
  Mail,
  Scale,
  Tag,
  Headphones,
  FileText,
  CalendarClock,
  Loader2,
  UserPlus,
  ChevronDown,
  ChevronRight,
  Quote,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AudioPlayer } from '../audio-player'
import { TranscriptViewer } from '../transcript-viewer'
import { DirectionIcon } from '../direction-indicator'
import { QUAL_META } from '@/lib/qualifications'
import { effectiveQualKey } from '@/lib/rdv'
import { agentLevel, leadGroupKey } from '@/lib/lead-key'
import { CRENEAUX } from '@/lib/timezone'
import { formatBmi } from '@/lib/bmi'
import type { CallLogEnriched } from '@/lib/types'
import type { HandoffCandidate } from '@/lib/director-metrics'

interface Props {
  candidate: HandoffCandidate | null
  allCalls: CallLogEnriched[]
  confirmedRdvLeadKeys: Set<string>
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssigned?: (leadId: string, to: string) => void
}

function fmtDur(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function HandoffDetailSheet({
  candidate,
  allCalls,
  confirmedRdvLeadKeys,
  open,
  onOpenChange,
  onAssigned,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [openCallId, setOpenCallId] = useState<string | null>(null)

  // History: every call whose leadGroupKey matches this candidate
  const history = useMemo(() => {
    if (!candidate) return []
    return allCalls
      .filter((c) => leadGroupKey(c) === candidate.leadId)
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      )
  }, [candidate, allCalls])

  const assign = async (to: string) => {
    if (!candidate) return
    setBusy(to)
    try {
      const res = await fetch('/api/dashboard/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: candidate.leadId,
          assignedTo: to,
          reason: candidate.reasons.join(' ; '),
          assignedBy: 'dashboard',
        }),
      })
      if (res.ok) {
        setDone(to)
        onAssigned?.(candidate.leadId, to)
      }
    } finally {
      setBusy(null)
    }
  }

  if (!candidate) return null

  const bmi = formatBmi(candidate.bmi, 'Non renseigné')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{candidate.name ?? 'Lead'}</SheetTitle>
          <SheetDescription>
            Dossier à confier · {history.length} appel(s) dans l&apos;historique
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Header info */}
          <section className="rounded-lg border bg-muted/20 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoField icon={<User className="h-3.5 w-3.5" />} label="Nom" value={candidate.name ?? '—'} />
              <InfoField icon={<Phone className="h-3.5 w-3.5" />} label="Téléphone" value={candidate.phone ?? '—'} mono />
              <InfoField icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={candidate.email ?? '—'} />
              <InfoField
                icon={<Scale className="h-3.5 w-3.5" />}
                label="BMI"
                value={bmi.text}
                mono
              />
              <InfoField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={candidate.source ?? '—'} />
              <InfoField
                icon={<CalendarClock className="h-3.5 w-3.5" />}
                label="Dernier appel"
                value={
                  candidate.lastCall
                    ? format(new Date(candidate.lastCall), 'dd/MM/yyyy HH:mm')
                    : '—'
                }
              />
            </div>
          </section>

          {/* Reasons */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-violet-400">
              Pourquoi ce dossier est flaggé
            </p>
            <div className="flex flex-wrap gap-2">
              {candidate.reasons.map((r) => (
                <Badge
                  key={r}
                  variant="outline"
                  className="border-violet-500/40 bg-violet-500/10 text-violet-300"
                >
                  {r}
                </Badge>
              ))}
            </div>
          </section>

          {/* Assign buttons (top) */}
          <section className="rounded-md border border-violet-500/30 bg-violet-950/10 p-3">
            {done ? (
              <Badge className="bg-emerald-500 text-white">
                ✓ {candidate.name ?? 'Lead'} confié à {done}
              </Badge>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm">
                  <UserPlus className="h-4 w-4 text-violet-400" /> Confier à un humain
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => assign('Rain')}
                  >
                    {busy === 'Rain' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Assigner à Rain
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => assign('Summer')}
                  >
                    {busy === 'Summer' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Assigner à Summer
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Historique d'appels */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Historique des appels ({history.length})
            </p>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun appel.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((c) => (
                  <CallEntry
                    key={c.callId}
                    call={c}
                    confirmed={confirmedRdvLeadKeys}
                    isOpen={openCallId === c.callId}
                    onToggle={() =>
                      setOpenCallId(openCallId === c.callId ? null : c.callId)
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function InfoField({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={`mt-0.5 truncate text-sm font-medium ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  )
}

function CallEntry({
  call,
  confirmed,
  isOpen,
  onToggle,
}: {
  call: CallLogEnriched
  confirmed: Set<string>
  isOpen: boolean
  onToggle: () => void
}) {
  const [audioTime, setAudioTime] = useState(0)
  const q = QUAL_META[effectiveQualKey(call, confirmed)]
  const lvl = agentLevel(call.agentName)

  return (
    <li className="rounded-md border border-border/50 bg-muted/10">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <DirectionIcon direction={call.direction} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {lvl ? `Agent ${lvl} · ` : ''}
              {call.agentName}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {call.startTime ? format(new Date(call.startTime), 'dd/MM HH:mm') : '—'} ·{' '}
              {CRENEAUX[call.creneau].short} · {fmtDur(call.duration)}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={`${q.badgeClass} shrink-0`}>
          {q.label}
        </Badge>
      </button>
      {isOpen && (
        <div className="space-y-3 border-t px-3 py-3">
          {call.summary && (
            <div className="rounded-md border border-violet-500/30 bg-violet-950/10 p-2.5">
              <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-violet-300">
                <Quote className="h-3 w-3" /> Résumé IA
              </p>
              <p className="text-sm">{call.summary}</p>
            </div>
          )}
          {call.recordingUrl && call.transcript && call.transcript.length > 0 ? (
            <>
              <div>
                <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Headphones className="h-3 w-3" /> Enregistrement
                </p>
                <AudioPlayer
                  src={call.recordingUrl}
                  transcript={call.transcript}
                  onTimeUpdate={setAudioTime}
                />
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-3 w-3" /> Transcription synchronisée
                </p>
                <TranscriptViewer transcript={call.transcript} currentTime={audioTime} />
              </div>
            </>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Pas d&apos;enregistrement ou transcription disponible pour cet appel.
            </p>
          )}
        </div>
      )}
    </li>
  )
}
