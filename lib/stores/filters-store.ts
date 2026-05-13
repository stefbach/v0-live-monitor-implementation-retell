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
      partialize: (s) => ({ filters: s.filters }),
    }
  )
)
