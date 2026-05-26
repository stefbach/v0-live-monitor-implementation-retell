import type Anthropic from '@anthropic-ai/sdk'
import type { InsightsCallInput } from './types'

const QUALIFICATIONS = [
  'RDV MEDECIN',
  'PAS INTERESSE',
  'PAS DE REPONSE',
  'FAUX NUMERO',
  'FOLLOW UP',
  'NOUVEAU DOSSIER',
  'TRANSFERRED_TO_ISABELLE',
] as const

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_calls',
    description:
      "Cherche dans les appels filtrés. Combine les filtres pour cibler (ex. PAS INTERESSE + mot-clé 'coût'). Renvoie un extrait du résumé de chaque appel correspondant.",
    input_schema: {
      type: 'object',
      properties: {
        qualification: {
          type: 'string',
          enum: [...QUALIFICATIONS],
          description: 'Filtrer par qualification exacte',
        },
        keyword: {
          type: 'string',
          description:
            "Mot-clé (case-insensitive) à chercher dans le résumé. Ex. 'coût', 'mari', 'BMI', 'ozempic'.",
        },
        min_duration_seconds: { type: 'number' },
        max_duration_seconds: { type: 'number' },
        answered_only: {
          type: 'boolean',
          description: "True = uniquement les appels avec réponse réelle (durée > 15s).",
        },
        limit: {
          type: 'number',
          description: 'Nombre max de résultats à renvoyer (défaut 15, max 50).',
        },
      },
    },
  },
  {
    name: 'get_call_detail',
    description:
      "Récupère le résumé complet d'un appel précis (jusqu'à 2000 caractères) à partir de son call_id.",
    input_schema: {
      type: 'object',
      required: ['call_id'],
      properties: {
        call_id: { type: 'string', description: "L'identifiant exact de l'appel" },
      },
    },
  },
  {
    name: 'get_aggregated_stats',
    description:
      "Renvoie des compteurs agrégés sur les appels filtrés selon une dimension. Utile pour répondre à 'combien d'appels par X'.",
    input_schema: {
      type: 'object',
      required: ['group_by'],
      properties: {
        group_by: {
          type: 'string',
          enum: ['qualification', 'hour_of_day', 'day_of_week', 'disconnect_reason'],
        },
      },
    },
  },
]

interface SearchInput {
  qualification?: string
  keyword?: string
  min_duration_seconds?: number
  max_duration_seconds?: number
  answered_only?: boolean
  limit?: number
}

interface DetailInput {
  call_id: string
}

interface AggInput {
  group_by: 'qualification' | 'hour_of_day' | 'day_of_week' | 'disconnect_reason'
}

export function executeChatTool(
  name: string,
  rawInput: unknown,
  calls: InsightsCallInput[]
): string {
  const input = (rawInput ?? {}) as Record<string, unknown>

  if (name === 'search_calls') {
    const i = input as SearchInput
    const limit = Math.min(typeof i.limit === 'number' ? i.limit : 15, 50)
    const kw = i.keyword?.toLowerCase()
    const filtered = calls.filter((c) => {
      if (i.qualification && c.qualification !== i.qualification) return false
      if (i.answered_only && !c.answered) return false
      if (typeof i.min_duration_seconds === 'number' && c.duration_seconds < i.min_duration_seconds) return false
      if (typeof i.max_duration_seconds === 'number' && c.duration_seconds > i.max_duration_seconds) return false
      if (kw) {
        const s = (c.summary ?? '').toLowerCase()
        if (!s.includes(kw)) return false
      }
      return true
    })

    const slice = filtered.slice(0, limit).map((c) => ({
      call_id: c.call_id,
      qualification: c.qualification,
      duration_s: c.duration_seconds,
      hour: c.hour_of_day,
      summary_excerpt: (c.summary ?? '').slice(0, 250),
    }))

    return JSON.stringify({
      total_matches: filtered.length,
      returned: slice.length,
      results: slice,
    })
  }

  if (name === 'get_call_detail') {
    const i = input as unknown as DetailInput
    const call = calls.find((c) => c.call_id === i.call_id)
    if (!call) return JSON.stringify({ error: `Aucun appel trouvé avec call_id=${i.call_id}` })
    return JSON.stringify({
      call_id: call.call_id,
      qualification: call.qualification,
      duration_seconds: call.duration_seconds,
      hour_of_day: call.hour_of_day,
      day_of_week: call.day_of_week,
      disconnect_reason: call.disconnection_reason,
      attempt: call.attempt_number,
      answered: call.answered,
      summary: (call.summary ?? '').slice(0, 2000),
    })
  }

  if (name === 'get_aggregated_stats') {
    const i = input as unknown as AggInput
    const buckets: Record<string, number> = {}
    for (const c of calls) {
      let key: string
      switch (i.group_by) {
        case 'qualification':
          key = c.qualification ?? 'UNKNOWN'
          break
        case 'hour_of_day':
          key = String(c.hour_of_day)
          break
        case 'day_of_week':
          key = String(c.day_of_week)
          break
        case 'disconnect_reason':
          key = c.disconnection_reason ?? 'unknown'
          break
      }
      buckets[key] = (buckets[key] ?? 0) + 1
    }
    return JSON.stringify({ group_by: i.group_by, total_calls: calls.length, counts: buckets })
  }

  return JSON.stringify({ error: `Outil inconnu: ${name}` })
}
