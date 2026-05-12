'use client'

import { useEffect, useState } from 'react'
import { Phone, PhoneIncoming, PhoneOutgoing, Radio } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useActiveCalls } from '@/lib/hooks/use-calls'
import { LiveCallSkeleton } from './skeleton-loaders'
import type { ActiveCall } from '@/lib/types'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function LiveCallCard({ call }: { call: ActiveCall }) {
  const [duration, setDuration] = useState(call.currentDuration)

  // Update duration every second
  useEffect(() => {
    const startTime = new Date(call.startTime).getTime()
    const updateDuration = () => {
      const now = Date.now()
      setDuration(Math.floor((now - startTime) / 1000))
    }

    updateDuration()
    const interval = setInterval(updateDuration, 1000)
    return () => clearInterval(interval)
  }, [call.startTime])

  return (
    <Card className="relative overflow-hidden">
      {/* Pulsing indicator */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500">
        <div className="h-full w-full animate-pulse bg-emerald-400" />
      </div>

      <CardContent className="pt-5">
        <div className="flex items-start gap-4">
          {/* Call direction icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            {call.direction === 'inbound' ? (
              <PhoneIncoming className="h-6 w-6 text-emerald-500" />
            ) : (
              <PhoneOutgoing className="h-6 w-6 text-emerald-500" />
            )}
          </div>

          {/* Call info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium truncate">{call.agentName}</p>
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
            <p className="text-sm text-muted-foreground truncate">
              {call.direction === 'inbound' ? call.fromNumber : call.toNumber}
            </p>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="font-mono text-emerald-500 font-medium">
                {formatDuration(duration)}
              </span>
              <Badge variant="outline" className="text-xs">
                {call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
              </Badge>
            </div>
          </div>
        </div>
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
                  <Badge className="bg-emerald-500 text-white ml-2">
                    {activeCalls.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Real-time active call monitoring</CardDescription>
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
