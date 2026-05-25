'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Phone,
  Clock,
  User,
  Bot,
  HeartPulse,
  Pill,
  Stethoscope,
  CalendarCheck,
  DollarSign,
  FileText,
  ArrowRight,
  Mail,
  Scale,
  AlertOctagon,
  UserPlus,
  Loader2,
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
import { Skeleton } from '@/components/ui/skeleton'
import { AudioPlayer } from './audio-player'
import { TranscriptViewer } from './transcript-viewer'
import { useCallDetail } from '@/lib/hooks/use-calls'
import { agentLevel } from '@/lib/director-metrics'
import { effectiveQualKey } from '@/lib/rdv'
import { useRdvStore } from '@/lib/stores/rdv-store'
import { QUAL_META } from '@/lib/qualifications'
import { formatBmi } from '@/lib/bmi'
import { DirectionIcon } from './direction-indicator'
import type { CallLogEnriched, Lead, Qualification } from '@/lib/types'

interface CallDetailSheetProps {
  callId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  allCalls?: CallLogEnriched[]
  onSelectCall?: (call: CallLogEnriched) => void
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatUsd(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

function getStatusBadge(status: CallLogEnriched['status']) {
  const variants: Record<CallLogEnriched['status'], { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    active: { label: 'Active', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    failed: { label: 'Failed', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
    'no-answer': { label: 'No Answer', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    busy: { label: 'Busy', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  }
  const v = variants[status]
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>
}

const QUALIF_STYLE: Record<string, string> = {
  'RDV MEDECIN': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  'NOUVEAU DOSSIER': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  'PAS INTERESSE': 'bg-red-500/10 text-red-400 border-red-500/30',
  'PAS DE REPONSE': 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  'FAUX NUMERO': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  'FOLLOW UP': 'bg-violet-500/10 text-violet-400 border-violet-500/30',
}

function getQualifBadge(q: Qualification | null | undefined) {
  if (!q) return null
  return (
    <Badge variant="outline" className={QUALIF_STYLE[q] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'}>
      {q}
    </Badge>
  )
}

function ageFromDob(dob: string | null): string {
  if (!dob) return '—'
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return '—'
  const ageMs = Date.now() - d.getTime()
  const years = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000))
  return `${years}`
}

export function CallDetailSheet({
  callId,
  open,
  onOpenChange,
  allCalls = [],
  onSelectCall,
}: CallDetailSheetProps) {
  const { call, isLoading } = useCallDetail(callId)
  const confirmedRdvLeadKeys = useRdvStore((s) => s.confirmedRdvLeadKeys)
  const fullLead = (call as (CallLogEnriched & { fullLead?: Lead | null }) | null)?.fullLead
  const [audioTime, setAudioTime] = useState(0)

  // Agent-chain timeline: the lead's other calls (handoff is across
  // separate call_ids linked by metadata.lead_id).
  const siblingCalls = useMemo(() => {
    if (!call) return []
    const leadId = call.meta?.leadId ?? call.lead?.id
    if (!leadId) return []
    return allCalls
      .filter(
        (c) =>
          (c.meta?.leadId ?? c.lead?.id) === leadId
      )
      .sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
  }, [call, allCalls])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Patient call detail</SheetTitle>
          <SheetDescription>
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : call ? (
              `Call ID: ${call.callId}`
            ) : (
              'Call not found'
            )}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : call ? (
          <div className="mt-6 space-y-6">
            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge(call.status)}
              {(() => {
                const m = QUAL_META[effectiveQualKey(call, confirmedRdvLeadKeys)]
                return (
                  <Badge variant="outline" className={m.badgeClass}>
                    {m.label}
                  </Badge>
                )
              })()}
              {call.direction === 'inbound' ? (
                <Badge variant="outline" className="gap-1">
                  <DirectionIcon direction="inbound" size="sm" /> Entrant
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <DirectionIcon direction="outbound" size="sm" /> Sortant
                </Badge>
              )}
              {call.cost != null && (
                <Badge variant="outline" className="gap-1 font-mono">
                  <DollarSign className="h-3 w-3" />
                  {formatUsd(call.cost)}
                </Badge>
              )}
            </div>

            {/* Patient block */}
            {(call.lead || fullLead) && (
              <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" /> Patient
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Name" value={fullLead?.nom ?? call.lead?.nom ?? '—'} />
                  <Field label="Phone" value={fullLead?.numero_telephone ?? call.lead?.numero_telephone ?? '—'} mono />
                  <Field label="Email" value={fullLead?.email ?? call.lead?.email ?? '—'} />
                  <Field label="DOB / age" value={`${fullLead?.patient_dob ?? '—'} (${ageFromDob(fullLead?.patient_dob ?? null)})`} />
                  <Field label="BMI" value={(fullLead?.bmi ?? call.lead?.bmi)?.toFixed?.(1) ?? '—'} mono />
                  <Field
                    label="Weight / Height"
                    value={`${fullLead?.poids ?? '—'} kg · ${fullLead?.taille ?? '—'} cm`}
                  />
                  <Field label="Source" value={fullLead?.source_lead ?? call.lead?.source_lead ?? '—'} />
                  <Field label="Calls so far" value={String(fullLead?.call_count ?? call.lead?.call_count ?? 0)} mono />
                </div>
              </section>
            )}

            {/* Appointment block */}
            {(fullLead?.date_rdv || fullLead?.rappel_rdv || fullLead?.email_sent != null) && (
              <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-emerald-500" /> Appointment & follow-up
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Appointment date" value={fullLead?.date_rdv ?? '—'} />
                  <Field
                    label="Reminder"
                    value={fullLead?.rappel_rdv ? format(new Date(fullLead.rappel_rdv), 'MMM d, HH:mm') : '—'}
                  />
                  <Field
                    label="Last call"
                    value={
                      fullLead?.last_call_datetime
                        ? format(new Date(fullLead.last_call_datetime), 'MMM d, HH:mm')
                        : '—'
                    }
                  />
                  <Field label="Email sent" value={fullLead?.email_sent ? 'Yes' : 'No'} />
                  <Field label="1st email" value={fullLead?.first_mail ?? '—'} />
                  <Field label="2nd email" value={fullLead?.second_mail ?? '—'} />
                </div>
              </section>
            )}

            {/* Medical block */}
            {fullLead && (fullLead.allergies || fullLead.current_medications || fullLead.past_surgeries || fullLead.nhs_wmp_status || fullLead.anesthesia_allergies || fullLead.other_chronic_conditions) && (
              <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-rose-500" /> Medical history
                </h3>
                <div className="space-y-3 text-sm">
                  <NoteField icon={<HeartPulse className="h-3.5 w-3.5" />} label="Allergies" value={fullLead.allergies} />
                  <NoteField icon={<HeartPulse className="h-3.5 w-3.5" />} label="Anesthesia allergies" value={fullLead.anesthesia_allergies} />
                  <NoteField icon={<Pill className="h-3.5 w-3.5" />} label="Current medications" value={fullLead.current_medications} />
                  <NoteField icon={<Stethoscope className="h-3.5 w-3.5" />} label="Past surgeries" value={fullLead.past_surgeries} />
                  <NoteField icon={<HeartPulse className="h-3.5 w-3.5" />} label="Other chronic conditions" value={fullLead.other_chronic_conditions} />
                  <NoteField icon={<FileText className="h-3.5 w-3.5" />} label="NHS WMP status" value={fullLead.nhs_wmp_status} />
                  <NoteField icon={<FileText className="h-3.5 w-3.5" />} label="NHS WMP details" value={fullLead.nhs_wmp_details} />
                </div>
              </section>
            )}

            {/* Call notes timeline */}
            {fullLead && (fullLead.note || fullLead.call_1_note || fullLead.call_2_note || fullLead.call_3_note) && (
              <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-500" /> Call history notes
                </h3>
                <div className="space-y-3 text-sm">
                  <NoteField label="Call 1" value={fullLead.call_1_note} />
                  <NoteField label="Call 2" value={fullLead.call_2_note} />
                  <NoteField label="Call 3" value={fullLead.call_3_note} />
                  {fullLead.note && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Timeline</p>
                      <pre className="rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap font-sans">
                        {fullLead.note}
                      </pre>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Current call meta */}
            <section className="grid grid-cols-2 gap-3 text-sm">
              <Field
                label="Started"
                value={call.startTime ? format(new Date(call.startTime), 'MMM d, yyyy HH:mm:ss') : '—'}
                icon={<Clock className="h-3 w-3" />}
              />
              <Field
                label="Duration"
                value={formatDuration(call.duration)}
                icon={<Clock className="h-3 w-3" />}
                mono
              />
              <Field label="Agent" value={call.agentName} icon={<Bot className="h-3 w-3" />} />
              <Field label="Call cost" value={formatUsd(call.cost)} icon={<DollarSign className="h-3 w-3" />} mono />
              <Field label="From" value={call.fromNumber} icon={<Phone className="h-3 w-3" />} mono />
              <Field label="To" value={call.toNumber} icon={<Phone className="h-3 w-3" />} mono />
            </section>

            {/* AI-extracted data cards */}
            {(call.analysis || fullLead) && (
              <section className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1">
                  <Bot className="h-3.5 w-3.5 text-violet-500" /> Données extraites par l&apos;IA
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <DataCard icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={fullLead?.email ?? '—'} />
                  <DataCard icon={<Scale className="h-3.5 w-3.5" />} label="BMI" value={formatBmi(fullLead?.bmi, 'Non renseigné').text} />
                  <DataCard icon={<Pill className="h-3.5 w-3.5" />} label="Médicaments" value={fullLead?.current_medications ?? '—'} />
                  <DataCard icon={<Stethoscope className="h-3.5 w-3.5" />} label="Chirurgies passées" value={fullLead?.past_surgeries ?? '—'} />
                  <DataCard icon={<HeartPulse className="h-3.5 w-3.5" />} label="Allergies" value={fullLead?.allergies ?? '—'} />
                  <DataCard icon={<AlertOctagon className="h-3.5 w-3.5" />} label="Préoccupation principale" value={call.analysis?.mainConcern ?? '—'} />
                  <DataCard icon={<AlertOctagon className="h-3.5 w-3.5" />} label="État émotionnel" value={call.analysis?.emotionalState ?? '—'} />
                  <DataCard icon={<CalendarCheck className="h-3.5 w-3.5" />} label="Dispo. annoncée" value={call.analysis?.availability ?? '—'} />
                </div>
                {call.analysis?.objectionsRaised && (
                  <p className="rounded-md bg-muted/40 p-2 text-xs">
                    <span className="font-medium">Objections : </span>
                    {call.analysis.objectionsRaised}
                  </p>
                )}
              </section>
            )}

            {/* Agent-chain timeline (sibling calls of the lead) */}
            {siblingCalls.length > 1 && (
              <section className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1">
                  <ArrowRight className="h-3.5 w-3.5 text-cyan-500" /> Parcours du lead ({siblingCalls.length} appels)
                </p>
                <ol className="space-y-1.5">
                  {siblingCalls.map((sc, i) => {
                    const lvl = agentLevel(sc.agentName)
                    const isCurrent = sc.callId === call.callId
                    return (
                      <li key={sc.callId}>
                        <button
                          disabled={isCurrent}
                          onClick={() => onSelectCall?.(sc)}
                          className={`flex w-full items-center justify-between gap-2 rounded-md border p-2 text-left text-xs transition-colors ${
                            isCurrent
                              ? 'border-cyan-500/50 bg-cyan-500/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono">
                              {i + 1}
                            </span>
                            <span className="truncate">
                              {lvl ? `Agent ${lvl}` : ''} {sc.agentName}
                            </span>
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {sc.startTime ? format(new Date(sc.startTime), 'dd/MM HH:mm') : '—'}
                            {sc.meta?.phase ? ` · ${sc.meta.phase}` : ''}
                            {isCurrent ? ' · (en cours)' : ''}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}

            {/* Confier à un humain */}
            {(call.meta?.leadId || call.lead?.id) && (
              <HandoffButtons
                leadId={(call.meta?.leadId ?? call.lead?.id) as string}
                leadName={call.lead?.nom ?? null}
              />
            )}

            {call.summary && (
              <section className="space-y-2">
                <p className="text-sm font-medium">Résumé</p>
                <p className="text-sm text-muted-foreground rounded-lg bg-muted/50 p-3">{call.summary}</p>
              </section>
            )}

            {call.recordingUrl && (
              <section className="space-y-2">
                <p className="text-sm font-medium">Enregistrement</p>
                <AudioPlayer
                  src={call.recordingUrl}
                  transcript={call.transcript ?? []}
                  onTimeUpdate={setAudioTime}
                />
              </section>
            )}

            {call.transcript && call.transcript.length > 0 && (
              <section className="space-y-2">
                <p className="text-sm font-medium">Transcription synchronisée</p>
                <TranscriptViewer transcript={call.transcript} currentTime={audioTime} />
              </section>
            )}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center justify-center py-12 text-center">
            <Phone className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">Call not found</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  value,
  icon,
  mono,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function DataCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium" title={value}>
        {value}
      </p>
    </div>
  )
}

function HandoffButtons({
  leadId,
  leadName,
}: {
  leadId: string
  leadName: string | null
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const assign = async (to: string) => {
    setBusy(to)
    try {
      const res = await fetch('/api/dashboard/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          assignedTo: to,
          reason: 'Confié depuis la fiche appel',
          assignedBy: 'dashboard',
        }),
      })
      if (res.ok) setDone(to)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="space-y-2">
      <p className="text-sm font-medium flex items-center gap-1">
        <UserPlus className="h-3.5 w-3.5 text-violet-500" /> Confier à un humain
      </p>
      {done ? (
        <Badge className="bg-emerald-500 text-white">
          {leadName ?? 'Lead'} confié à {done}
        </Badge>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!!busy}
            onClick={() => assign('Rain')}
          >
            {busy === 'Rain' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Confier à Rain
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!!busy}
            onClick={() => assign('Summer')}
          >
            {busy === 'Summer' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Confier à Summer
          </Button>
        </div>
      )}
    </section>
  )
}

function NoteField({
  label,
  value,
  icon,
}: {
  label: string
  value: string | null | undefined
  icon?: React.ReactNode
}) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
        {icon}
        {label}
      </p>
      <p className="rounded-md bg-muted/40 p-2 text-sm whitespace-pre-wrap">{value}</p>
    </div>
  )
}

