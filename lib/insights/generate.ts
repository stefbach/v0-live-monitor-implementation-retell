import { getDeepSeek, DEEPSEEK_MODEL } from '@/lib/llm'
import { buildSystemPrompt, INSIGHTS_TOOL, buildUserMessage } from './prompts'
import type { InsightsCallInput, InsightsResult } from './types'

const MAX_CALLS_TO_LLM = 400 // safety cap

interface GenerateArgs {
  calls: InsightsCallInput[]
  periodLabel: string
}

function selectCalls(calls: InsightsCallInput[]): InsightsCallInput[] {
  if (calls.length <= MAX_CALLS_TO_LLM) return calls
  // Priority: keep all RDV (precious signal), all PAS INTERESSE up to 60,
  // then fill the rest in chronological order.
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

// DeepSeek's function-calling sometimes returns slightly malformed JSON
// (trailing commas, unescaped quotes inside strings). Try lenient repair
// before giving up.
function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    // Strip trailing commas before ] or }
    const cleaned = raw.replace(/,(\s*[}\]])/g, '$1')
    try {
      return JSON.parse(cleaned) as Record<string, unknown>
    } catch {
      throw new Error(
        'Le LLM a renvoyé un JSON invalide. Réessaie en cliquant "Re-générer".'
      )
    }
  }
}

export async function generateInsights({
  calls,
  periodLabel,
}: GenerateArgs): Promise<InsightsResult> {
  const startedAt = Date.now()
  const client = getDeepSeek()
  if (!client) {
    throw new Error(
      "DEEPSEEK_API_KEY n'est pas configurée. Ajoute-la dans les variables d'environnement Vercel puis redéploie."
    )
  }

  const callsWithSummary = calls.filter(
    (c) => typeof c.summary === 'string' && c.summary.trim().length > 10
  )
  const selected = selectCalls(callsWithSummary)
  const stats = aggregateStats(calls)

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

  const completion = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: userMessage },
    ],
    tools: [INSIGHTS_TOOL],
    tool_choice: { type: 'function', function: { name: 'emit_insights' } },
    max_tokens: 4000,
    temperature: 0.3,
  })

  const message = completion.choices?.[0]?.message
  const toolCall = message?.tool_calls?.[0]
  if (!toolCall || toolCall.type !== 'function') {
    throw new Error(
      "Le LLM n'a pas appelé l'outil structuré. Réessaie ou contacte l'équipe technique."
    )
  }

  const insights = parseToolArguments(toolCall.function.arguments) as Omit<
    InsightsResult,
    'meta'
  >

  return {
    ...insights,
    meta: {
      generated_at: new Date().toISOString(),
      calls_analysed: calls.length,
      calls_with_summary: callsWithSummary.length,
      period_label: periodLabel,
      model: DEEPSEEK_MODEL,
      cached: false,
      elapsed_ms: Date.now() - startedAt,
    },
  }
}
