import { create } from 'zustand'

// Set of leadGroupKey() values whose calls satisfy the strict RDV CONFIRME
// criteria (computed once per dataset in useDashboardData and consumed by
// effectiveQualKey() throughout the UI without prop-drilling).
interface RdvStoreState {
  confirmedRdvLeadKeys: Set<string>
  setConfirmedRdvLeadKeys: (keys: Set<string>) => void
}

export const useRdvStore = create<RdvStoreState>()((set) => ({
  confirmedRdvLeadKeys: new Set(),
  setConfirmedRdvLeadKeys: (keys) => set({ confirmedRdvLeadKeys: keys }),
}))
