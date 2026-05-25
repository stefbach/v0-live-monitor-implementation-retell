// Maps raw leads_rdv.qualification values (the ONLY source of truth for
// the CRM state of a lead) to the dashboard's 9 display qualifications.
//
// Anything outside the 9 cards — including the bootstrap state
// 'NOUVEAU DOSSIER', a missing qualification, or an unknown value — is
// routed to 'pas_de_reponse' so every call lives in exactly one card
// and the totals always sum to the number of calls displayed.

export type QualKey =
  | 'rdv_confirme'
  | 'a_passer_a_humain'
  | 'rappel'
  | 'pas_interesse'
  | 'pas_de_reponse'
  | 'repondeur'
  | 'faux_numero'
  | 'non_eligible'
  | 'ne_pas_rappeler'

export interface QualMeta {
  key: QualKey
  label: string
  badgeClass: string // for <Badge variant="outline">
  dotClass: string // small colour dot / bar
  cardAccent: string // left-border / ring accent for CRM cards
  hex: string // canonical hex from spec
}

const RAW_TO_KEY: Record<string, QualKey> = {
  'RDV MEDECIN': 'rdv_confirme',
  'RDV CONFIRME': 'rdv_confirme',
  "À PASSER À L'HUMAIN": 'a_passer_a_humain',
  "A PASSER A L'HUMAIN": 'a_passer_a_humain',
  'A PASSER A HUMAIN': 'a_passer_a_humain',
  TRANSFERRED_TO_ISABELLE: 'a_passer_a_humain',
  HUMAN_HANDOFF: 'a_passer_a_humain',
  CALLBACK_SCHEDULED: 'rappel',
  'FOLLOW UP': 'rappel',
  RAPPEL: 'rappel',
  'PAS INTERESSE': 'pas_interesse',
  'PAS DE REPONSE': 'pas_de_reponse',
  REPONDEUR: 'repondeur',
  'FAUX NUMERO': 'faux_numero',
  'NON ELIGIBLE': 'non_eligible',
  'NE PAS RAPPELER': 'ne_pas_rappeler',
  // NOUVEAU DOSSIER = lead never engaged → counted as "pas de réponse".
  'NOUVEAU DOSSIER': 'pas_de_reponse',
}

export const QUAL_META: Record<QualKey, QualMeta> = {
  rdv_confirme: {
    key: 'rdv_confirme',
    label: 'RDV CONFIRME',
    badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    cardAccent: 'border-l-emerald-500',
    hex: '#10B981',
  },
  a_passer_a_humain: {
    key: 'a_passer_a_humain',
    label: "À PASSER À L'HUMAIN",
    badgeClass: 'bg-sky-500/10 text-sky-500 border-sky-500/30',
    dotClass: 'bg-sky-500',
    cardAccent: 'border-l-sky-500',
    hex: '#0EA5E9',
  },
  rappel: {
    key: 'rappel',
    label: 'RAPPEL',
    badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    dotClass: 'bg-orange-500',
    cardAccent: 'border-l-orange-500',
    hex: '#F97316',
  },
  pas_interesse: {
    key: 'pas_interesse',
    label: 'PAS INTERESSE',
    badgeClass: 'bg-red-500/10 text-red-500 border-red-500/30',
    dotClass: 'bg-red-500',
    cardAccent: 'border-l-red-500',
    hex: '#EF4444',
  },
  pas_de_reponse: {
    key: 'pas_de_reponse',
    label: 'PAS DE REPONSE',
    badgeClass: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    dotClass: 'bg-gray-500',
    cardAccent: 'border-l-gray-500',
    hex: '#6B7280',
  },
  repondeur: {
    key: 'repondeur',
    label: 'REPONDEUR',
    badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/40',
    dotClass: 'bg-amber-500',
    cardAccent: 'border-l-amber-500',
    hex: '#F59E0B',
  },
  faux_numero: {
    key: 'faux_numero',
    label: 'FAUX NUMERO',
    badgeClass: 'bg-red-700/15 text-red-500 border-red-700/40',
    dotClass: 'bg-red-700',
    cardAccent: 'border-l-red-700',
    hex: '#DC2626',
  },
  non_eligible: {
    key: 'non_eligible',
    label: 'NON ELIGIBLE',
    badgeClass: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    dotClass: 'bg-violet-500',
    cardAccent: 'border-l-violet-500',
    hex: '#8B5CF6',
  },
  ne_pas_rappeler: {
    key: 'ne_pas_rappeler',
    label: 'NE PAS RAPPELER',
    badgeClass: 'bg-gray-800 text-gray-300 border-gray-700',
    dotClass: 'bg-gray-800',
    cardAccent: 'border-l-gray-800',
    hex: '#1F2937',
  },
}

// Final card order (matches the user-approved spec, top to bottom,
// left to right in the grid).
export const QUALIFICATION_CARDS: QualKey[] = [
  'rdv_confirme',
  'a_passer_a_humain',
  'rappel',
  'pas_interesse',
  'pas_de_reponse',
  'repondeur',
  'faux_numero',
  'non_eligible',
  'ne_pas_rappeler',
]

// Anything unmappable → 'pas_de_reponse' so every call lives in exactly
// one card. No 'autre' bucket. No Retell-derived overlay. Source = the
// raw string in leads_rdv.qualification.
export function qualKeyFromRaw(raw: string | null | undefined): QualKey {
  if (!raw) return 'pas_de_reponse'
  return RAW_TO_KEY[raw.trim().toUpperCase()] ?? 'pas_de_reponse'
}

export function mapQualification(raw: string | null | undefined): QualMeta {
  return QUAL_META[qualKeyFromRaw(raw)]
}
