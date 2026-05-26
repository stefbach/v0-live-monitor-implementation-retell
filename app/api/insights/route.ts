import { NextResponse } from 'next/server'
import { generateInsights } from '@/lib/insights/generate'
import { getCached, makeCacheKey, setCached } from '@/lib/insights/cache'
import type { InsightsRequest, InsightsResult } from '@/lib/insights/types'
import type { ApiResponse } from '@/lib/types'
import { anthropicConfigured } from '@/lib/llm'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // seconds — Vercel Pro cap; Sonnet may take 60-120s on full periods

export async function POST(
  request: Request
): Promise<NextResponse<ApiResponse<InsightsResult | null>>> {
  if (!anthropicConfigured()) {
    return NextResponse.json(
      {
        data: null,
        error:
          "ANTHROPIC_API_KEY n'est pas configurée. Ajoute-la dans les variables d'environnement Vercel puis redéploie.",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }

  let body: InsightsRequest
  try {
    body = (await request.json()) as InsightsRequest
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: 'Invalid JSON body',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    )
  }

  const calls = Array.isArray(body.calls) ? body.calls : []
  if (calls.length === 0) {
    return NextResponse.json(
      {
        data: null,
        error: 'Aucun appel à analyser pour la période sélectionnée.',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    )
  }

  const periodLabel = body.period_label || 'Période inconnue'
  const cacheKey = makeCacheKey(
    calls.map((c) => c.call_id),
    periodLabel
  )

  if (!body.force_refresh) {
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({ data: cached, timestamp: new Date().toISOString() })
    }
  }

  try {
    const insights = await generateInsights({ calls, periodLabel })
    setCached(cacheKey, insights)
    return NextResponse.json({ data: insights, timestamp: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error:
          error instanceof Error
            ? error.message
            : 'Échec de la génération des insights',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
