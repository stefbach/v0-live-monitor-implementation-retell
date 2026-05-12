'use client'

import { useEffect, useRef, useMemo } from 'react'
import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TranscriptSegment } from '@/lib/types'

interface TranscriptViewerProps {
  transcript: TranscriptSegment[]
  currentTime?: number
  onSegmentClick?: (segment: TranscriptSegment) => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function TranscriptViewer({
  transcript,
  currentTime = 0,
  onSegmentClick,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Find the active segment based on current time
  const activeSegmentId = useMemo(() => {
    const segment = transcript.find(
      (seg) => currentTime >= seg.startTime && currentTime < seg.endTime
    )
    return segment?.id
  }, [transcript, currentTime])

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current
      const element = activeRef.current
      const containerRect = container.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()

      // Check if element is outside visible area
      if (
        elementRect.top < containerRect.top ||
        elementRect.bottom > containerRect.bottom
      ) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeSegmentId])

  return (
    <div
      ref={containerRef}
      className="max-h-64 overflow-y-auto rounded-lg border bg-muted/30 p-3 space-y-3"
    >
      {transcript.map((segment) => {
        const isActive = segment.id === activeSegmentId
        const isAgent = segment.speaker === 'agent'

        return (
          <div
            key={segment.id}
            ref={isActive ? activeRef : undefined}
            className={cn(
              'flex gap-3 p-2 rounded-lg transition-colors cursor-pointer',
              isActive
                ? 'bg-primary/10 border border-primary/20'
                : 'hover:bg-muted/50',
              !isAgent && 'flex-row-reverse'
            )}
            onClick={() => onSegmentClick?.(segment)}
          >
            {/* Speaker Icon */}
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                isAgent ? 'bg-blue-500/10' : 'bg-emerald-500/10'
              )}
            >
              {isAgent ? (
                <Bot className="h-4 w-4 text-blue-500" />
              ) : (
                <User className="h-4 w-4 text-emerald-500" />
              )}
            </div>

            {/* Content */}
            <div className={cn('flex-1 min-w-0', !isAgent && 'text-right')}>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'text-xs font-medium',
                    isAgent ? 'text-blue-500' : 'text-emerald-500',
                    !isAgent && 'order-2'
                  )}
                >
                  {isAgent ? 'Agent' : 'User'}
                </span>
                <span
                  className={cn(
                    'text-xs text-muted-foreground font-mono',
                    !isAgent && 'order-1'
                  )}
                >
                  {formatTime(segment.startTime)}
                </span>
              </div>
              <p
                className={cn(
                  'text-sm leading-relaxed',
                  isActive && 'font-medium'
                )}
              >
                {segment.text}
              </p>
            </div>
          </div>
        )
      })}

      {transcript.length === 0 && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          No transcript available
        </div>
      )}
    </div>
  )
}
