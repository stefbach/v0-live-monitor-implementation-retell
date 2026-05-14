'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { InsightsResult } from '@/lib/insights/types'

// Persistent client-side cache of generated insights.
// Keyed by (period_label + hash of call_ids) so:
//   - switching tabs / refreshing the page restores the same analysis
//     instantly without re-calling the LLM (no cost),
//   - switching to a different period or filter set transparently
//     uses its own entry (or shows "Generate" if not yet generated),
//   - browser restart preserves entries via localStorage.

const MAX_ENTRIES = 30 // cap localStorage growth

interface InsightsState {
  cache: Record<string, InsightsResult>
  setEntry: (key: string, result: InsightsResult) => void
  getEntry: (key: string) => InsightsResult | null
  clearAll: () => void
}

export const useInsightsStore = create<InsightsState>()(
  persist(
    (set, get) => ({
      cache: {},
      setEntry: (key, result) =>
        set((s) => {
          const entries = Object.entries(s.cache)
          // Evict oldest when over cap (simple FIFO based on insertion order)
          const trimmed =
            entries.length >= MAX_ENTRIES
              ? Object.fromEntries(entries.slice(-MAX_ENTRIES + 1))
              : s.cache
          return { cache: { ...trimmed, [key]: result } }
        }),
      getEntry: (key) => get().cache[key] ?? null,
      clearAll: () => set({ cache: {} }),
    }),
    { name: 'ai-insights-cache', version: 1 }
  )
)

// Cache key derived from period + sorted call_ids hash.
// Matches the server-side cache key shape for easier debugging.
export function makeInsightsKey(periodLabel: string, callIds: string[]): string {
  const sorted = [...callIds].sort().join('|')
  let h = 0
  const str = `${periodLabel}::${sorted}`
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return `${periodLabel}-${callIds.length}-${h.toString(36)}`
}
