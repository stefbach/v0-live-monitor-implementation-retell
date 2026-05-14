'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashboardFilters } from '@/lib/types'
import { DEFAULT_FILTERS } from '@/lib/filters'

interface FiltersState {
  filters: DashboardFilters
  setFilters: (f: DashboardFilters | ((prev: DashboardFilters) => DashboardFilters)) => void
  patch: (patch: Partial<DashboardFilters>) => void
  reset: () => void
  toggleArray: <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K] extends Array<infer V> ? V : never
  ) => void
}

// Merge persisted state with DEFAULT_FILTERS so that:
//   - older localStorage entries that lack new fields don't crash
//     (e.g. filters.durations.length when durations was added later)
//   - we always have a complete, well-typed filters object
function safeMerge(
  persistedState: unknown,
  currentState: FiltersState
): FiltersState {
  const p = persistedState as { filters?: Partial<DashboardFilters> } | null
  return {
    ...currentState,
    filters: { ...DEFAULT_FILTERS, ...(p?.filters ?? {}) },
  }
}

export const useFiltersStore = create<FiltersState>()(
  persist(
    (set) => ({
      filters: DEFAULT_FILTERS,
      setFilters: (f) =>
        set((s) => ({ filters: typeof f === 'function' ? f(s.filters) : f })),
      patch: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
      reset: () => set({ filters: DEFAULT_FILTERS }),
      toggleArray: (key, value) =>
        set((s) => {
          const arr = (s.filters[key] as unknown as unknown[]).slice()
          const idx = arr.indexOf(value as unknown)
          if (idx >= 0) arr.splice(idx, 1)
          else arr.push(value)
          return { filters: { ...s.filters, [key]: arr } as DashboardFilters }
        }),
    }),
    {
      name: 'dashboard-filters',
      version: 2,
      partialize: (s) => ({ filters: s.filters }),
      merge: safeMerge,
    }
  )
)
