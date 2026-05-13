import { getAnthropic, INSIGHTS_MODEL } from '@/lib/llm'
import { INSIGHTS_SYSTEM_PROMPT, INSIGHTS_TOOL, buildUserMessage } from './prompts'
import type { InsightsCallInput, InsightsResult } from './types'

const MAX_CALLS_TO_LLM = 400 // budget guard

interface GenerateArgs {
  calls: InsightsCallInput[]
  periodLabel: string
}

function selectCalls(calls: InsightsCallInput[]): InsightsCallInput[] {
  if (calls.length <= MAX_CALLS_TO_LLM) return calls
  // Priority: keep all RDV (precious signal), all PAS INTERESSE, then sample rest
  const rdv = calls.filter((c) => c.qualification === 'RDV MEDECIN')
  const lost = calls.filter((c) => c.qualification === 'PAS INTERESSE')
  const rest = calls.filter(
    (c) => c.qualification !== 'RDV MEDECIN' && c.qualification !== 'PAS INTERESSE'
  )
  const budget = MAX_CALLS_TO_LLM - rdv.length - Math.min(lost.length, 60)
  return [...rdv, ...lost.slice(0, 60), ...rest.slice(0, Math.max(budget, 0))]
}

function aggregateStats(calls: InsightsCallInput[]) {
  const total = calls.length
  let rdv = 0,
    pas_interesse = 0,
    pas_de_reponse = 0,
    faux_numero = 0,
    follow_up = 0,
    nouveau_dossier = 0,
    answered = 0,
    duration = 0
  for (const c of calls) {
    switch (c.qualification) {
      case 'RDV MEDECIN':
        rdv++
        break
      case 'PAS INTERESSE':
        pas_interesse++
        break
      case 'PAS DE REPONSE':
        pas_de_reponse++
        break
      case 'FAUX NUMERO':
        faux_numero++
        break
      case 'FOLLOW UP':
        follow_up++
        break
      case 'NOUVEAU DOSSIER':
        nouveau_dossier++
        break
    }
    if (c.answered) answered++
    duration += c.duration_seconds
  }
  return {
    total,
    rdv,
    pas_interesse,
    pas_de_reponse,
    faux_numero,
    follow_up,
    nouveau_dossier,
    answered,
    avg_duration_seconds: total > 0 ? duration / total : 0,
  }
}

export async function generateInsights({
  calls,
  periodLabel,
}: GenerateArgs): Promise<InsightsResult> {
  const startedAt = Date.now()
  const anthropic = getAnthropic()
  if (!anthropic) {
    throw new Error(
      'ANTHROPIC_API_KEY is not configured. Add it as an environment variable on Vercel.'
    )
  }

  const callsWithSummary = calls.filter(
    (c) => typeof c.summary === 'string' && c.summary.trim().length > 10
  )
  const selected = selectCalls(callsWithSummary)
  const stats = aggregateStats(calls)

  // Build a compact JSON for the LLM (drop nulls, trim summary to 600 chars).
  const compact = selected.map((c) => ({
    id: c.call_id,
    qualification: c.qualification ?? 'UNKNOWN',
    sentiment: c.sentiment ?? null,
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

  const response = await anthropic.messages.create({
    model: INSIGHTS_MODEL,
    max_tokens: 4000,
    system: INSIGHTS_SYSTEM_PROMPT,
    tools: [INSIGHTS_TOOL],
    tool_choice: { type: 'tool', name: 'emit_insights' },
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  })

  const toolUse = response.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('LLM did not return structured insights (no tool_use block).')
  }

  const insights = toolUse.input as Omit<InsightsResult, 'meta'>

  return {
    ...insights,
    meta: {
      generated_at: new Date().toISOString(),
      calls_analysed: calls.length,
      calls_with_summary: callsWithSummary.length,
      period_label: periodLabel,
      model: INSIGHTS_MODEL,
      cached: false,
      elapsed_ms: Date.now() - startedAt,
    },
  }
}
