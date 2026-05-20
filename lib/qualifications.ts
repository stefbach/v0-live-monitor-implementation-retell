// Maps raw leads_rdv.qualification values (source of truth for the CRM
// state of a lead) to the dashboard's display taxonomy + colour palette.
//
// Decided with the user:
//   RDV MEDECIN                                  → RDV CONFIRME (vert)
//   CALLBACK_SCHEDULED | FOLLOW UP | RAPPEL       → RAPPEL (orange)
//   PAS INTERESSE                                → PAS INTERESSE (rouge)
//   PAS DE REPONSE                               → PAS DE REPONSE (gris)
//   FAUX NUMERO                                  → FAUX NUMERO (rouge foncé)
//   NOUVEAU DOSSIER                              → NOUVEAU DOSSIER (bleu)
//   NE PAS RAPPELER                              → NE PAS RAPPELER (noir, manuel)
//   NON ELIGIBLE                                 → calculé (BMI hors S2), pas stocké
//   TRANSFERRED_TO_ISABELLE                      → "autre" (hors des 8 cards,
//                                                  visible dans la chaîne d'agents)

export type QualKey =
  | 'rdv_confirme'
  | 'rdv_non_confirme'
  | 'rappel'
  | 'pas_interesse'
  | 'pas_de_reponse'
  | 'repondeur'
  | 'faux_numero'
  | 'nouveau_dossier'
  | 'non_eligible'
  | 'ne_pas_rappeler'
  | 'autre'

export interface QualMeta {
  key: QualKey
  label: string
  badgeClass: string // for <Badge variant="outline">
  dotClass: string // small colour dot / bar
  cardAccent: string // left-border / ring accent for CRM cards
}

const RAW_TO_KEY: Record<string, QualKey> = {
  'RDV MEDECIN': 'rdv_confirme',
  'RDV CONFIRME': 'rdv_confirme',
  CALLBACK_SCHEDULED: 'rappel',
  'FOLLOW UP': 'rappel',
  RAPPEL: 'rappel',
  'PAS INTERESSE': 'pas_interesse',
  'PAS DE REPONSE': 'pas_de_reponse',
  REPONDEUR: 'repondeur',
  'FAUX NUMERO': 'faux_numero',
  'NOUVEAU DOSSIER': 'nouveau_dossier',
  'NE PAS RAPPELER': 'ne_pas_rappeler',
  TRANSFERRED_TO_ISABELLE: 'autre',
}

export const QUAL_META: Record<QualKey, QualMeta> = {
  rdv_confirme: {
    key: 'rdv_confirme',
    label: 'RDV CONFIRME',
    badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    cardAccent: 'border-l-emerald-500',
  },
  rdv_non_confirme: {
    key: 'rdv_non_confirme',
    label: 'RDV (non confirmé)',
    badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/40',
    dotClass: 'bg-amber-500',
    cardAccent: 'border-l-amber-500',
  },
  rappel: {
    key: 'rappel',
    label: 'RAPPEL',
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    dotClass: 'bg-orange-500',
    cardAccent: 'border-l-orange-500',
  },
  pas_interesse: {
    key: 'pas_interesse',
    label: 'PAS INTERESSE',
    badgeClass: 'bg-red-500/10 text-red-400 border-red-500/30',
    dotClass: 'bg-red-500',
    cardAccent: 'border-l-red-500',
  },
  pas_de_reponse: {
    key: 'pas_de_reponse',
    label: 'PAS DE REPONSE',
    badgeClass: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
    dotClass: 'bg-zinc-500',
    cardAccent: 'border-l-zinc-500',
  },
  repondeur: {
    key: 'repondeur',
    label: 'REPONDEUR',
    badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/40',
    dotClass: 'bg-amber-500',
    cardAccent: 'border-l-amber-500',
  },
  faux_numero: {
    key: 'faux_numero',
    label: 'FAUX NUMERO',
    badgeClass: 'bg-rose-700/15 text-rose-400 border-rose-700/40',
    dotClass: 'bg-rose-700',
    cardAccent: 'border-l-rose-700',
  },
  nouveau_dossier: {
    key: 'nouveau_dossier',
    label: 'NOUVEAU DOSSIER',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    dotClass: 'bg-blue-500',
    cardAccent: 'border-l-blue-500',
  },
  non_eligible: {
    key: 'non_eligible',
    label: 'NON ELIGIBLE',
    badgeClass: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    dotClass: 'bg-violet-500',
    cardAccent: 'border-l-violet-500',
  },
  ne_pas_rappeler: {
    key: 'ne_pas_rappeler',
    label: 'NE PAS RAPPELER',
    badgeClass: 'bg-zinc-900 text-zinc-300 border-zinc-700',
    dotClass: 'bg-zinc-900',
    cardAccent: 'border-l-zinc-700',
  },
  autre: {
    key: 'autre',
    label: 'AUTRE',
    badgeClass: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
    dotClass: 'bg-zinc-500',
    cardAccent: 'border-l-zinc-500',
  },
}

// Cards shown on the Vue d'ensemble, in display order.
// NOUVEAU DOSSIER is intentionally NOT in the cards: that label is the
// CRM default state before any call has been placed. Calls whose lead is
// still tagged NOUVEAU DOSSIER are re-routed into a concrete bucket
// (RAPPEL / REPONDEUR / PAS DE REPONSE) based on the call signals — see
// computeQualificationCounts in lib/director-metrics.ts.
export const QUALIFICATION_CARDS: QualKey[] = [
  'rdv_confirme',
  'rappel',
  'pas_interesse',
  'pas_de_reponse',
  'repondeur',
  'faux_numero',
  'non_eligible',
  'ne_pas_rappeler',
]

export function qualKeyFromRaw(raw: string | null | undefined): QualKey {
  if (!raw) return 'autre'
  return RAW_TO_KEY[raw.trim().toUpperCase()] ?? 'autre'
}

export function mapQualification(raw: string | null | undefined): QualMeta {
  return QUAL_META[qualKeyFromRaw(raw)]
}
