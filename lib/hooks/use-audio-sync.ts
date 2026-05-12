'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { TranscriptSegment } from '@/lib/types'

interface UseAudioSyncOptions {
  transcript: TranscriptSegment[]
  onSegmentChange?: (segment: TranscriptSegment | null) => void
}

export function useAudioSync({ transcript, onSegmentChange }: UseAudioSyncOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [activeSegment, setActiveSegment] = useState<TranscriptSegment | null>(null)

  // Find active segment based on current time
  const findActiveSegment = useCallback(
    (time: number): TranscriptSegment | null => {
      return transcript.find(
        (seg) => time >= seg.startTime && time < seg.endTime
      ) || null
    },
    [transcript]
  )

  // Handle time updates from audio element
  const handleTimeUpdate = useCallback(
    (time: number) => {
      setCurrentTime(time)
      const segment = findActiveSegment(time)
      if (segment?.id !== activeSegment?.id) {
        setActiveSegment(segment)
        onSegmentChange?.(segment)
      }
    },
    [findActiveSegment, activeSegment, onSegmentChange]
  )

  // Jump to a specific segment
  const jumpToSegment = useCallback(
    (segment: TranscriptSegment) => {
      if (audioRef.current) {
        audioRef.current.currentTime = segment.startTime
        setCurrentTime(segment.startTime)
        setActiveSegment(segment)
      }
    },
    []
  )

  // Set up audio element reference
  const setAudioRef = useCallback((element: HTMLAudioElement | null) => {
    audioRef.current = element
  }, [])

  return {
    currentTime,
    activeSegment,
    setAudioRef,
    handleTimeUpdate,
    jumpToSegment,
  }
}
