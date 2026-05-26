import { NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropic, ANTHROPIC_MODEL, anthropicConfigured } from '@/lib/llm'
import { CHAT_TOOLS, executeChatTool } from '@/lib/insights/chat-tools'
import type { InsightsCallInput, InsightsResult } from '@/lib/insights/types'
import type { ApiResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequestBody {
  messages: ChatMessage[]
  calls: InsightsCallInput[]
  insights: InsightsResult | null
  period_label: string
}

interface ChatReply {
  reply: string
  tool_calls: number
}

const MAX_AGENTIC_TURNS = 6

function buildSystemPrompt(args: {
  periodLabel: string
  calls: InsightsCallInput[]
  insights: InsightsResult | null
}): Anthropic.TextBlockParam[] {
  const { periodLabel, calls, insights } = args
  const withSummary = calls.filter(
    (c) => typeof c.summary === 'string' && c.summary.trim().length > 10
  ).length

  const qualCounts: Record<string, number> = {}
  for (const c of calls) {
    const q = c.qualification ?? 'UNKNOWN'
    qualCounts[q] = (qualCounts[q] ?? 0) + 1
  }

  const insightsSummary = insights
    ? JSON.stringify(
        {
          pulse: insights.pulse,
          strategic_alerts: insights.strategic_alerts,
          top_objections: (insights.objections ?? []).slice(0, 5).map((o) => ({
            label: o.label,
            count: o.count,
            percent: o.percent,
          })),
          emerging_keywords: insights.trends?.emerging_keywords?.slice(0, 8),
          sentiment_summary: {
            average_score: insights.sentiment?.average_score,
            distribution: insights.sentiment?.distribution,
            hot_leads_count: insights.sentiment?.hot_leads?.length ?? 0,
          },
        },
        null,
        2
      )
    : 'Aucun insight pré-calculé disponible (l\'utilisateur n\'a pas encore lancé la génération).'

  return [
    {
      type: 'text',
      text: `Tu es un assistant analytique pour le directeur d'un call-center d'une clinique de chirurgie de l'obésité au Royaume-Uni (parcours NHS WMP S2). Tu réponds à des questions sur les appels téléphoniques entre des agents IA et des prospects.

Règles :
1. Réponds TOUJOURS en français professionnel et concis (2 à 6 phrases sauf si l'utilisateur demande plus de détails).
2. Cite toujours les call_id exacts quand tu fais référence à un appel.
3. Utilise les outils \`search_calls\`, \`get_call_detail\`, \`get_aggregated_stats\` pour creuser plutôt que d'inventer. Mais n'appelle pas un outil si la réponse est déjà dans le contexte.
4. Si l'utilisateur te demande un script ou un counter-argument, marque-le clairement comme "Suggestion à valider".
5. Si la question dépasse les données disponibles, dis-le franchement.
6. Sois actionnable : préfère "appelle X aujourd'hui car Y" à "il faudrait peut-être réfléchir à…".`,
    },
    {
      type: 'text',
      text: `Contexte de cette session :

Période analysée : ${periodLabel}
Nombre d'appels disponibles : ${calls.length} (dont ${withSummary} avec un résumé exploitable)

Répartition par qualification :
${Object.entries(qualCounts)
  .map(([q, n]) => `- ${q} : ${n}`)
  .join('\n')}

Insights stratégiques déjà générés pour la période :
\`\`\`json
${insightsSummary}
\`\`\`

Tu peux interroger les détails des appels via tes outils.`,
      cache_control: { type: 'ephemeral' },
    },
  ]
}

export async function POST(
  request: Request
): Promise<NextResponse<ApiResponse<ChatReply | null>>> {
  if (!anthropicConfigured()) {
    return NextResponse.json(
      {
        data: null,
        error: "ANTHROPIC_API_KEY n'est pas configurée sur Vercel.",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }

  let body: ChatRequestBody
  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body', timestamp: new Date().toISOString() },
      { status: 400 }
    )
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  const calls = Array.isArray(body.calls) ? body.calls : []
  if (messages.length === 0) {
    return NextResponse.json(
      { data: null, error: 'Aucun message fourni', timestamp: new Date().toISOString() },
      { status: 400 }
    )
  }

  const client = getAnthropic()
  if (!client) {
    return NextResponse.json(
      { data: null, error: 'Client Anthropic non initialisé', timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }

  const system = buildSystemPrompt({
    periodLabel: body.period_label || 'Période inconnue',
    calls,
    insights: body.insights,
  })

  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  let toolCallsCount = 0

  try {
    for (let turn = 0; turn < MAX_AGENTIC_TURNS; turn++) {
      const response = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        system,
        messages: apiMessages,
        tools: CHAT_TOOLS,
        temperature: 0.4,
      })

      if (response.stop_reason !== 'tool_use') {
        const text = response.content
          .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
          .map((b) => b.text)
          .join('\n\n')
          .trim()
        return NextResponse.json({
          data: { reply: text || 'Pas de réponse.', tool_calls: toolCallsCount },
          timestamp: new Date().toISOString(),
        })
      }

      apiMessages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        toolCallsCount++
        const result = executeChatTool(block.name, block.input, calls)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        })
      }
      apiMessages.push({ role: 'user', content: toolResults })
    }

    return NextResponse.json({
      data: {
        reply: "J'ai épuisé mon budget d'outils. Reformule ta question pour qu'elle soit plus ciblée.",
        tool_calls: toolCallsCount,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Erreur lors de la génération',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
