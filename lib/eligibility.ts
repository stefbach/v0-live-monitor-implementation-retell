import type { Lead, LeadSummary, EligibilityResult } from './types'

// S2 UK NHS Weight Management Programme eligibility (Tier 3/4):
//   BMI ≥ 40, OR
//   BMI ≥ 35 + at least one obesity-related comorbidity
//
// Common qualifying comorbidities: Type 2 diabetes, hypertension,
// dyslipidemia, obstructive sleep apnea, NAFLD/NASH, severe OA,
// PCOS, GERD, depression linked to obesity.
//
// We scan free-text fields with keyword matching (FR + EN) — this is
// approximate; we surface the detected list so a human can verify.

interface ComorbidityRule {
  label: string
  patterns: RegExp[]
}

const COMORBIDITY_RULES: ComorbidityRule[] = [
  {
    label: 'Type 2 Diabetes',
    patterns: [/\bdiab[ée]t/i, /\bT2D\b/i, /\bDM2\b/i, /\btype\s*2\b/i, /\bnidd?m\b/i],
  },
  {
    label: 'Hypertension',
    patterns: [/\bhypertens/i, /\bHTN\b/i, /\bhigh\s+blood\s+pressure\b/i, /\btension\s+art/i],
  },
  {
    label: 'Sleep apnea',
    patterns: [/\bapn(?:o?ea|ée)/i, /\bOSA\b/i, /\bSAOS\b/i, /\bSAS\b/i, /\bCPAP\b/i],
  },
  {
    label: 'Dyslipidemia',
    patterns: [/\bdyslip/i, /\bcholest[ée]rol/i, /\btriglyc/i, /\bhyperlip/i],
  },
  {
    label: 'NAFLD / fatty liver',
    patterns: [/\bNAFLD\b/i, /\bNASH\b/i, /\bfatty\s+liver/i, /\bst[ée]atose/i, /\bfoie\s+gras/i],
  },
  {
    label: 'Osteoarthritis',
    patterns: [/\bosteoarthr/i, /\barthros/i, /\bOA\b/i, /\bgonarthr/i, /\bcoxarthr/i],
  },
  {
    label: 'PCOS',
    patterns: [/\bPCOS\b/i, /\bSOPK\b/i, /\bpolycyst/i, /\bovaires?\s+polykyst/i],
  },
  {
    label: 'GERD / reflux',
    patterns: [/\bGERD\b/i, /\bGORD\b/i, /\breflux\b/i, /\bRGO\b/i],
  },
  {
    label: 'Cardiovascular disease',
    patterns: [/\bCVD\b/i, /\bIHD\b/i, /\bcardiovasc/i, /\binfarct/i, /\bAVC\b/i, /\bstroke\b/i],
  },
  {
    label: 'Depression',
    patterns: [/\bd[ée]pression\b/i, /\bdepressed\b/i, /\bantidepress/i],
  },
]

function detectComorbidities(...texts: (string | null | undefined)[]): string[] {
  const blob = texts.filter(Boolean).join(' \n ')
  if (!blob) return []
  const hits = new Set<string>()
  for (const rule of COMORBIDITY_RULES) {
    if (rule.patterns.some((p) => p.test(blob))) {
      hits.add(rule.label)
    }
  }
  return [...hits]
}

type EligibilitySource = Pick<
  Lead,
  | 'bmi'
  | 'nhs_wmp_status'
  | 'nhs_wmp_details'
  | 'other_chronic_conditions'
  | 'current_medications'
  | 'note'
  | 'allergies'
>

export function computeEligibility(lead: EligibilitySource | null): EligibilityResult {
  if (!lead) {
    return { eligible: false, reason: 'unknown', comorbidities: [], bmi: null }
  }
  const bmi = typeof lead.bmi === 'number' ? lead.bmi : null
  const comorbidities = detectComorbidities(
    lead.nhs_wmp_status,
    lead.nhs_wmp_details,
    lead.other_chronic_conditions,
    lead.current_medications,
    lead.note
  )

  if (bmi == null) {
    return { eligible: false, reason: 'unknown', comorbidities, bmi: null }
  }
  if (bmi >= 40) {
    return { eligible: true, reason: 'bmi_40', comorbidities, bmi }
  }
  if (bmi >= 35 && comorbidities.length > 0) {
    return { eligible: true, reason: 'bmi_35_with_comorbidity', comorbidities, bmi }
  }
  return { eligible: false, reason: 'bmi_below', comorbidities, bmi }
}

// Lightweight variant for leads that only have summary fields available.
// Comorbidities can't be detected from summary → only BMI gate.
export function computeEligibilityFromSummary(
  lead: LeadSummary | null
): EligibilityResult {
  if (!lead) return { eligible: false, reason: 'unknown', comorbidities: [], bmi: null }
  const bmi = typeof lead.bmi === 'number' ? lead.bmi : null
  if (bmi == null)
    return { eligible: false, reason: 'unknown', comorbidities: [], bmi: null }
  if (bmi >= 40) return { eligible: true, reason: 'bmi_40', comorbidities: [], bmi }
  // Without comorbidity detection from a summary, mark BMI 35-39 as 'unknown'
  if (bmi >= 35)
    return { eligible: false, reason: 'unknown', comorbidities: [], bmi }
  return { eligible: false, reason: 'bmi_below', comorbidities: [], bmi }
}
