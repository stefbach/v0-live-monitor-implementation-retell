// Shape of the structured insights returned by the LLM. Mirrors the
// JSON schema enforced via Anthropic tool_use.

export type AlertSeverity = 'low' | 'medium' | 'high'

export interface PulseHighlight {
  label: string
  value: string
}

export interface InsightsPulse {
  summary: string // 3-4 sentence narrative in French
  highlights: PulseHighlight[] // 2-4 short labelled metrics
}

export interface StrategicAlert {
  severity: AlertSeverity
  message: string
  evidence_count: number // how many calls / signals support this alert
}

export interface ObjectionInsight {
  label: string
  count: number
  percent: number
  example_call_ids: string[]
  counter_argument: string // labelled as "Suggestion à valider"
}

export interface TrendKeyword {
  keyword: string
  count: number
  note: string
}

export interface InsightsTrends {
  emerging_keywords: TrendKeyword[]
  weak_signals: string[]
}

export interface HangupTopic {
  topic: string
  count: number
  example_call_ids: string[]
}

export interface WinningPattern {
  phrase_or_theme: string
  frequency_in_won: number
  frequency_in_lost: number
}

export interface ScriptAudit {
  common_hangup_topics: HangupTopic[]
  converted_call_patterns: WinningPattern[]
}

export interface HotLead {
  call_id: string
  reason: string
}

export interface SentimentClimate {
  average_score: number // 0-10
  distribution: {
    positive: number
    neutral: number
    negative: number
  }
  hot_leads: HotLead[]
}

export interface OptimizationHypothesis {
  observation: string // what was observed in the data
  test_to_run: string // a concrete A/B test to validate
}

export interface InsightsResult {
  pulse: InsightsPulse
  strategic_alerts: StrategicAlert[]
  objections: ObjectionInsight[]
  trends: InsightsTrends
  script_audit: ScriptAudit
  sentiment: SentimentClimate
  optimization_hypotheses: OptimizationHypothesis[]
  meta: {
    generated_at: string
    calls_analysed: number
    calls_with_summary: number
    period_label: string
    model: string
    cached: boolean
    elapsed_ms: number
  }
}

// Input shape sent to the LLM (PII-stripped)
export interface InsightsCallInput {
  call_id: string
  summary: string | null
  qualification: string | null
  sentiment: string | null
  duration_seconds: number
  hour_of_day: number
  day_of_week: number
  disconnection_reason: string | null
  attempt_number: number
  answered: boolean
}

// Client → server request body for /api/insights
export interface InsightsRequest {
  calls: InsightsCallInput[]
  period_label: string
  force_refresh?: boolean
}
