// Retell AI Call Types

export type CallStatus = 'active' | 'completed' | 'failed' | 'no-answer' | 'busy'
export type CallDirection = 'inbound' | 'outbound'

export interface TranscriptSegment {
  id: string
  speaker: 'agent' | 'user'
  text: string
  startTime: number // seconds
  endTime: number // seconds
}

export interface CallLog {
  id: string
  callId: string
  agentId: string
  agentName: string
  status: CallStatus
  direction: CallDirection
  duration: number // seconds
  startTime: string // ISO date
  endTime: string | null // ISO date
  fromNumber: string
  toNumber: string
  userId?: string
  userName?: string
  sentiment?: 'positive' | 'neutral' | 'negative'
  transcript?: TranscriptSegment[]
  recordingUrl?: string
  summary?: string
  metadata?: Record<string, unknown>
}

export interface ActiveCall {
  id: string
  callId: string
  agentId: string
  agentName: string
  direction: CallDirection
  startTime: string
  fromNumber: string
  toNumber: string
  currentDuration: number // seconds, calculated
  status: 'active'
}

export interface CallMetrics {
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  noAnswerCalls: number
  busyCalls: number
  successRate: number
  averageDuration: number
  totalDuration: number
  activeCalls: number
}

export interface HourlyCallData {
  hour: string // "00:00", "01:00", etc.
  calls: number
  successful: number
  failed: number
}

export interface DailyCallData {
  date: string // "Mon", "Tue", etc. or full date
  calls: number
  successful: number
  failed: number
  avgDuration: number
}

export interface DurationBucket {
  range: string // "0-30s", "30-60s", etc.
  count: number
}

export interface HeatmapCell {
  day: number // 0-6 (Sunday-Saturday)
  hour: number // 0-23
  value: number // call count
}

export type TimeRange = 'hourly' | 'daily' | 'weekly' | 'monthly'

export interface ApiResponse<T> {
  data: T
  error?: string
  timestamp: string
}

export interface RetellHealthStatus {
  status: 'healthy' | 'degraded' | 'down'
  apiKeyConfigured: boolean
  lastCheck: string
  message?: string
}

// ─── Leads / CRM ────────────────────────────────────────────────────────────

export type Qualification =
  | 'NOUVEAU DOSSIER'
  | 'PAS INTERESSE'
  | 'RDV MEDECIN'
  | 'FAUX NUMERO'
  | 'PAS DE REPONSE'
  | 'FOLLOW UP'
  | 'TRANSFERRED_TO_ISABELLE'
  | string

export interface Lead {
  id: string
  nom: string | null
  email: string | null
  numero_telephone: string | null
  poids: number | null
  taille: number | null
  bmi: number | null
  source_lead: string | null
  form_facebook: string | null
  agent: string | null
  date_rdv: string | null
  date_creation: string | null
  qualification: Qualification | null
  note: string | null
  rappel_rdv: string | null
  call_count: number | null
  last_qualification_update: string | null
  first_mail: string | null
  second_mail: string | null
  allergies: string | null
  anesthesia_allergies: string | null
  current_medications: string | null
  past_surgeries: string | null
  nhs_wmp_status: string | null
  nhs_wmp_details: string | null
  other_chronic_conditions: string | null
  patient_dob: string | null
  email_sent: boolean | null
  last_call_datetime: string | null
  call_1_note: string | null
  call_2_note: string | null
  call_3_note: string | null
}

// Patient details surfaced alongside a call (sub-projection of Lead)
export interface LeadSummary {
  id: string
  nom: string | null
  email: string | null
  numero_telephone: string | null
  bmi: number | null
  poids: number | null
  taille: number | null
  patient_dob: string | null
  qualification: Qualification | null
  source_lead: string | null
  call_count: number | null
  date_rdv: string | null
  rappel_rdv: string | null
  last_call_datetime: string | null
}

// ─── Business / Cost metrics ────────────────────────────────────────────────

export interface QualificationBreakdown {
  qualification: Qualification
  count: number
  percent: number
}

export interface SourceBreakdown {
  source: string
  total: number
  rdv: number
  conversionRate: number // % of source-leads ending in RDV MEDECIN
}

export interface AgentPerformance {
  agentId: string
  agentName: string
  calls: number
  rdv: number
  rdvRate: number // % rdv / calls
  avgDuration: number // seconds
  totalCost: number // cents
}

export interface ConversionFunnel {
  leads: number
  contacted: number
  interested: number // anything not in {PAS INTERESSE, FAUX NUMERO}
  rdvBooked: number
  contactRate: number
  interestRate: number
  bookingRate: number
}

export interface CostPoint {
  date: string // YYYY-MM-DD
  cost: number // cents
  calls: number
}

export interface CostSummary {
  totalCost: number // cents, period total
  avgCostPerCall: number // cents
  costPerRdv: number // cents
  todayCost: number // cents
  weekCost: number // cents
  monthCost: number // cents
  daily: CostPoint[]
}

export interface BusinessMetrics {
  totalLeads: number
  newLeadsToday: number
  rdvThisWeek: number
  rdvToday: number
  rdvRate: number // RDV MEDECIN / contacted (%)
  contactRate: number // contacted / total leads (%)
  avgCallsBeforeRdv: number
  qualifications: QualificationBreakdown[]
  sources: SourceBreakdown[]
  agents: AgentPerformance[]
  funnel: ConversionFunnel
}

// ─── Enriched call shape (Retell + Lead + cost + agent name) ────────────────

// Retell metadata injected by n8n on each call
export interface CallMetadataInfo {
  leadId: string | null
  phase: string | null // J1 / J3 / J5
  today: string | null
  j1Attempts: number | null
  j3Attempts: number | null
  j5Attempts: number | null
}

// call_analysis.custom_analysis_data
export interface CallCustomAnalysis {
  callOutcome: string | null // per-call outcome (e.g. "rdv_confirme")
  interestLevel: string | null
  objectionsRaised: string | null
  callbackScheduled: boolean | null
  callbackDatetime: string | null
  transferToIsabelle: boolean | null
  humanTransferTriggered: boolean | null
  availability: string | null
  mainConcern: string | null
  emotionalState: string | null
}

export type CreneauKey = 'creneau_1' | 'creneau_2' | 'creneau_3' | 'hors_creneau'

export interface CallLogEnriched extends CallLog {
  cost: number | null // cents (Retell combined_cost)
  lead: LeadSummary | null
  disconnectionReason: string | null
  attemptNumber: number // 1-based, position of this call in the lead's call sequence
  answered: boolean // proxy: duration > 15s AND not auto-disconnect
  hourOfDay: number // 0-23 in Europe/London (UK)
  dayOfWeek: number // 0-6 (0 = Sunday) in Europe/London (UK)
  creneau: CreneauKey
  meta: CallMetadataInfo | null
  analysis: CallCustomAnalysis | null
  inVoicemail: boolean | null // call_analysis.in_voicemail
  voicemailSuspected: boolean // undetected voicemail heuristic
  robotAwareness: boolean | null // null until full transcript fetched (enrich-on-click)
}

export interface ActiveCallEnriched extends ActiveCall {
  lead: LeadSummary | null
}

// ─── Eligibility (S2 UK NHS WMP) ────────────────────────────────────────────

export interface EligibilityResult {
  eligible: boolean
  reason: 'bmi_40' | 'bmi_35_with_comorbidity' | 'bmi_below' | 'unknown'
  comorbidities: string[]
  bmi: number | null
}

// ─── Filters ────────────────────────────────────────────────────────────────

export type PeriodId = 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom'

export type DurationBucketId =
  | 'lt15s'
  | '15s-1m'
  | '1-2m'
  | '2-3m'
  | '3-5m'
  | 'gt5m'

export type AttemptBucketId = '1' | '2' | '3plus'

export type EligibilityFilter = 'all' | 'eligible' | 'ineligible' | 'unknown'

export type AnsweredFilter = 'all' | 'answered' | 'no_answer'

export interface DashboardFilters {
  period: PeriodId
  customStart: string | null // ISO date
  customEnd: string | null // ISO date
  durations: DurationBucketId[]
  qualifications: string[]
  sources: string[]
  agents: string[] // agent_id list
  attempts: AttemptBucketId[]
  eligibility: EligibilityFilter
  answered: AnsweredFilter
  search: string
}

// ─── Heatmap (24×7) ─────────────────────────────────────────────────────────

export interface HeatmapDayHourCell {
  dayOfWeek: number // 0-6
  hour: number // 0-23
  total: number
  answered: number
  rdv: number
  answerRate: number
  rdvRate: number
}

// ─── Attempt funnel ─────────────────────────────────────────────────────────

export interface AttemptStat {
  attempt: number // 1, 2, 3, ...
  leadsReached: number // distinct leads that had at least this attempt
  answered: number
  rdv: number
  answerRate: number
  rdvRate: number
}

// ─── Agent chain (sequence agent A → B → C across attempts) ────────────────

export interface AgentChainNode {
  agentId: string
  agentName: string
  reached: number // leads whose journey includes this agent
  rdv: number // leads that ended in RDV after passing this agent
  conversionRate: number
}

export interface AgentChainEdge {
  fromAgentId: string
  fromAgentName: string
  toAgentId: string
  toAgentName: string
  count: number
}

// ─── Verbatim ───────────────────────────────────────────────────────────────

export interface VerbatimEntry {
  callId: string
  qualification: string | null
  summary: string
  agentName: string
  duration: number
  startTime: string
  leadName: string | null
}

// ─── Period delta ───────────────────────────────────────────────────────────

export interface DeltaValue {
  current: number
  previous: number
  delta: number // current - previous
  pctChange: number // ((current - previous) / previous) * 100, 0 if previous=0
}

