import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TimeRange } from '@/lib/types'

interface TimeRangeState {
  timeRange: TimeRange
  setTimeRange: (range: TimeRange) => void
}

export const useTimeRangeStore = create<TimeRangeState>()(
  persist(
    (set) => ({
      timeRange: 'daily',
      setTimeRange: (range) => set({ timeRange: range }),
    }),
    {
      name: 'call-dashboard-time-range',
    }
  )
)
