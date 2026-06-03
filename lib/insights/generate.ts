import { getAnthropic, ANTHROPIC_MODEL } from '@/lib/llm'
import { buildSystemPrompt, INSIGHTS_TOOL, buildUserMessage } from './prompts'
import type { InsightsCallInput, InsightsResult } from './types'

const MAX_CALLS_TO_LLM = 400 // safety cap (Vercel Pro: maxDuration 300s)

interface GenerateArgs {
  calls: InsightsCallInput[]
  periodLabel: string
}

// All counters and selection use qualification_effective — the same view
// as the qualification cards on the dashboard. The raw CRM qualification
// (c.qualification) is still passed alongside for transparency.
function selectCalls(calls: InsightsCallInput[]): InsightsCallInput[] {
  if (calls.length <= MAX_CALLS_TO_LLM) return calls
  // Priority: keep all confirmed RDV (precious signal), all PAS INTERESSE
  // up to 60, then fill the rest.
  const rdv = calls.filter((c) => c.qualification_effective === 'RDV CONFIRME')
  const lost = calls.filter((c) => c.qualification_effective === 'PAS INTERESSE')
  const rest = calls.filter(
    (c) =>
      c.qualification_effective !== 'RDV CONFIRME' &&
      c.qualification_effective !== 'PAS INTERESSE'
  )
  const budget = MAX_CALLS_TO_LLM - rdv.length - Math.min(lost.length, 60)
  return [...rdv, ...lost.slice(0, 60), ...rest.slice(0, Math.max(budget, 0))]
}

function aggregateStats(calls: InsightsCallInput[]) {
  const total = calls.length
  let rdv = 0,
    a_passer_a_humain = 0,
    rappel = 0,
    pas_interesse = 0,
    pas_de_reponse = 0,
    repondeur = 0,
    faux_numero = 0,
    non_eligible = 0,
    ne_pas_rappeler = 0,
    answered = 0,
    duration = 0
  for (const c of calls) {
    switch (c.qualification_effective) {
      case 'RDV CONFIRME':
        rdv++
        break
      case "À PASSER À L'HUMAIN":
        a_passer_a_humain++
        break
      case 'RAPPEL':
        rappel++
        break
      case 'PAS INTERESSE':
        pas_interesse++
        break
      case 'PAS DE REPONSE':
        pas_de_reponse++
        break
      case 'REPONDEUR':
        repondeur++
        break
      case 'FAUX NUMERO':
        faux_numero++
        break
      case 'NON ELIGIBLE':
        non_eligible++
        break
      case 'NE PAS RAPPELER':
        ne_pas_rappeler++
        break
    }
    if (c.answered) answered++
    duration += c.duration_seconds
  }
  return {
    total,
    rdv,
    a_passer_a_humain,
    rappel,
    pas_interesse,
    pas_de_reponse,
    repondeur,
    faux_numero,
    non_eligible,
    ne_pas_rappeler,
    answered,
    avg_duration_seconds: total > 0 ? duration / total : 0,
  }
}

// Claude's tool-use response sometimes omits optional-feeling fields even when
// the schema marks them required. Normalize the raw output so that every field
// expected by the UI is present with a safe default.
function normalizeInsights(raw: unknown): Omit<InsightsResult, 'meta'> {
  const r = (raw ?? {}) as Record<string, unknown>
  const pulse = (r.pulse ?? {}) as Record<string, unknown>
  const trends = (r.trends ?? {}) as Record<string, unknown>
  const audit = (r.script_audit ?? {}) as Record<string, unknown>
  const sentiment = (r.sentiment ?? {}) as Record<string, unknown>
  const distribution = (sentiment.distribution ?? {}) as Record<string, unknown>

  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  const asNumber = (v: unknown, fallback = 0): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback
  const asString = (v: unknown, fallback = ''): string =>
    typeof v === 'string' ? v : fallback

  return {
    pulse: {
      summary: asString(pulse.summary, 'Analyse en cours…'),
      highlights: asArray<Record<string, unknown>>(pulse.highlights).map((h) => ({
        label: asString(h.label),
        value: asString(h.value),
      })),
    },
    strategic_alerts: asArray<Record<string, unknown>>(r.strategic_alerts).map((a) => ({
      severity:
        a.severity === 'high' || a.severity === 'medium' || a.severity === 'low'
          ? (a.severity as 'high' | 'medium' | 'low')
          : 'low',
      message: asString(a.message),
      evidence_count: asNumber(a.evidence_count),
    })),
    objections: asArray<Record<string, unknown>>(r.objections).map((o) => ({
      label: asString(o.label),
      count: asNumber(o.count),
      percent: asNumber(o.percent),
      example_call_ids: asArray<string>(o.example_call_ids).filter(
        (s) => typeof s === 'string'
      ),
      counter_argument: asString(o.counter_argument),
    })),
    trends: {
      emerging_keywords: asArray<Record<string, unknown>>(trends.emerging_keywords).map(
        (k) => ({
          keyword: asString(k.keyword),
          count: asNumber(k.count),
          note: asString(k.note),
        })
      ),
      weak_signals: asArray<string>(trends.weak_signals).filter(
        (s) => typeof s === 'string'
      ),
    },
    script_audit: {
      common_hangup_topics: asArray<Record<string, unknown>>(audit.common_hangup_topics).map(
        (t) => ({
          topic: asString(t.topic),
          count: asNumber(t.count),
          example_call_ids: asArray<string>(t.example_call_ids).filter(
            (s) => typeof s === 'string'
          ),
        })
      ),
      converted_call_patterns: asArray<Record<string, unknown>>(
        audit.converted_call_patterns
      ).map((p) => ({
        phrase_or_theme: asString(p.phrase_or_theme),
        frequency_in_won: asNumber(p.frequency_in_won),
        frequency_in_lost: asNumber(p.frequency_in_lost),
      })),
    },
    sentiment: {
      average_score: asNumber(sentiment.average_score),
      distribution: {
        positive: asNumber(distribution.positive),
        neutral: asNumber(distribution.neutral),
        negative: asNumber(distribution.negative),
      },
      hot_leads: asArray<Record<string, unknown>>(sentiment.hot_leads).map((h) => ({
        call_id: asString(h.call_id),
        reason: asString(h.reason),
      })),
    },
    optimization_hypotheses: asArray<Record<string, unknown>>(
      r.optimization_hypotheses
    ).map((h) => ({
      observation: asString(h.observation),
      test_to_run: asString(h.test_to_run),
    })),
  }
}

export async function generateInsights({
  calls,
  periodLabel,
}: GenerateArgs): Promise<InsightsResult> {
  const startedAt = Date.now()
  const client = getAnthropic()
  if (!client) {
    throw new Error(
      "ANTHROPIC_API_KEY n'est pas configurée. Ajoute-la dans les variables d'environnement Vercel puis redéploie."
    )
  }

  const callsWithSummary = calls.filter(
    (c) => typeof c.summary === 'string' && c.summary.trim().length > 10
  )
  const selected = selectCalls(callsWithSummary)
  const stats = aggregateStats(calls)

  const compact = selected.map((c) => ({
    id: c.call_id,
    // Dashboard view — the LLM MUST use this for all qualification counting.
    qualification: c.qualification_effective,
    // Raw CRM tag (often pre-set by closers before real confirmation).
    // Kept for transparency only; do NOT count from this field.
    qualification_crm: c.qualification ?? 'UNKNOWN',
    duration_s: c.duration_seconds,
    hour: c.hour_of_day,
    dow: c.day_of_week,
    disconnect: c.disconnection_reason ?? null,
    attempt: c.attempt_number,
    answered: c.answered,
    summary: (c.summary ?? '').slice(0, 600),
  }))

  const userMessage = buildUserMessage({
    periodLabel,
    callsAnalysed: calls.length,
    callsWithSummary: callsWithSummary.length,
    stats,
    callsJson: JSON.stringify(compact),
  })

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: userMessage }],
    tools: [INSIGHTS_TOOL],
    tool_choice: { type: 'tool', name: 'emit_insights' },
    temperature: 0.3,
  })

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: 'tool_use' }> =>
      block.type === 'tool_use'
  )
  if (!toolUse) {
    throw new Error(
      "Le LLM n'a pas appelé l'outil structuré. Réessaie ou contacte l'équipe technique."
    )
  }

  const insights = normalizeInsights(toolUse.input)

  return {
    ...insights,
    meta: {
      generated_at: new Date().toISOString(),
      calls_analysed: calls.length,
      calls_with_summary: callsWithSummary.length,
      period_label: periodLabel,
      model: ANTHROPIC_MODEL,
      cached: false,
      elapsed_ms: Date.now() - startedAt,
    },
  }
}
