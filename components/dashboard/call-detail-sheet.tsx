'use client'

import { format } from 'date-fns'
import { Phone, Clock, User, Bot, PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AudioPlayer } from './audio-player'
import { TranscriptViewer } from './transcript-viewer'
import { useCallDetail } from '@/lib/hooks/use-calls'
import type { CallLog } from '@/lib/types'

interface CallDetailSheetProps {
  callId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getStatusBadge(status: CallLog['status']) {
  const variants: Record<CallLog['status'], { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    active: { label: 'Active', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    failed: { label: 'Failed', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
    'no-answer': { label: 'No Answer', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    busy: { label: 'Busy', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  }
  const variant = variants[status]
  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  )
}

function getSentimentBadge(sentiment?: 'positive' | 'neutral' | 'negative') {
  if (!sentiment) return null
  const variants = {
    positive: { label: 'Positive', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    neutral: { label: 'Neutral', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
    negative: { label: 'Negative', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
  }
  const variant = variants[sentiment]
  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  )
}

export function CallDetailSheet({ callId, open, onOpenChange }: CallDetailSheetProps) {
  const { call, isLoading } = useCallDetail(callId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Call Details</SheetTitle>
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
            <div className="space-y-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-16 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        ) : call ? (
          <div className="mt-6 space-y-6">
            {/* Status and Info */}
            <div className="flex items-center gap-2">
              {getStatusBadge(call.status)}
              {getSentimentBadge(call.sentiment)}
              {call.direction === 'inbound' ? (
                <Badge variant="outline" className="gap-1">
                  <PhoneIncoming className="h-3 w-3" /> Inbound
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <PhoneOutgoing className="h-3 w-3" /> Outbound
                </Badge>
              )}
            </div>

            {/* Call Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Started
                </p>
                <p className="text-sm font-medium">
                  {format(new Date(call.startTime), 'MMM d, yyyy HH:mm:ss')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Duration
                </p>
                <p className="text-sm font-medium font-mono">
                  {formatDuration(call.duration)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Bot className="h-3 w-3" /> Agent
                </p>
                <p className="text-sm font-medium">{call.agentName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Contact
                </p>
                <p className="text-sm font-medium">{call.userName || 'Unknown'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> From
                </p>
                <p className="text-sm font-mono">{call.fromNumber}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> To
                </p>
                <p className="text-sm font-mono">{call.toNumber}</p>
              </div>
            </div>

            {/* Summary */}
            {call.summary && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Summary</p>
                <p className="text-sm text-muted-foreground rounded-lg bg-muted/50 p-3">
                  {call.summary}
                </p>
              </div>
            )}

            {/* Audio Player */}
            {call.recordingUrl && call.transcript && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Recording</p>
                <AudioPlayer
                  src={call.recordingUrl}
                  transcript={call.transcript}
                />
              </div>
            )}

            {/* Transcript */}
            {call.transcript && call.transcript.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Transcript</p>
                <TranscriptViewer
                  transcript={call.transcript}
                  currentTime={0}
                />
              </div>
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
