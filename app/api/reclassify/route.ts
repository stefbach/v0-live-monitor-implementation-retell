import { NextResponse } from 'next/server'
import { getAnthropic, ANTHROPIC_MODEL, anthropicConfigured } from '@/lib/llm'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface RequestBody {
  callIds: string[]
}

interface ReclassifyResult {
  callId: string
  retellOutcome: string | null
  supabaseQualification: string | null
  claudeSuggestion: string
  leadId: string | null
}

const ALLOWED_LABELS = [
  'RDV CONFIRME',
  "À PASSER À L'HUMAIN",
  'RAPPEL',
  'PAS INTERESSE',
  'PAS DE REPONSE',
  'REPONDEUR',
  'FAUX NUMERO',
  'NON ELIGIBLE',
  'NE PAS RAPPELER',
] as const

const SYSTEM_PROMPT = `Tu es un expert en classification d'appels OCC (Obesity Care Clinic UK). Analyse une transcription d'appel et détermine la qualification correcte parmi exactement ces 9 labels :
- RDV CONFIRME
- À PASSER À L'HUMAIN
- RAPPEL
- PAS INTERESSE
- PAS DE REPONSE
- REPONDEUR
- FAUX NUMERO
- NON ELIGIBLE
- NE PAS RAPPELER

Règles strictes :
- Appel 0 seconde ou non connecté → PAS DE REPONSE
- Appel < 5 secondes → REPONDEUR (si voicemail/répondeur) ou PAS DE REPONSE
- FAUX NUMERO uniquement si invalid_destination ou le patient dit explicitement mauvais numéro
- À PASSER À L'HUMAIN uniquement si > 30 secondes et conversation réelle avec un potentiel (besoin de validation médicale, doute fort, demande explicite d'humain)
- NE PAS RAPPELER si le patient demande à être retiré de la liste
- RDV CONFIRME uniquement si un RDV concret est pris (date, heure, ou consultation médecin acceptée et confirmée)
- NON ELIGIBLE si le patient est manifestement hors critères (BMI annoncé < 35, refus catégorique du parcours NHS WMP S2)
- RAPPEL si callback explicitement demandé
- PAS INTERESSE si refus clair

Réponds UNIQUEMENT avec le nom exact de la qualification, en majuscules, sans ponctuation ni explication.`

function pickLabel(text: string): string {
  const upper = text.trim().toUpperCase()
  for (const label of ALLOWED_LABELS) {
    if (upper.includes(label)) return label
  }
  return 'PAS DE REPONSE'
}

interface RetellCallRaw {
  call_id?: string
  transcript?: string
  transcript_object?: Array<{ role?: string; content?: string }>
  duration_ms?: number
  call_analysis?: {
    custom_analysis_data?: { call_outcome?: string }
  }
  metadata?: { lead_id?: string }
  from_number?: string
  to_number?: string
}

async function fetchCallDetail(callId: string): Promise<RetellCallRaw | null> {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) return null
  try {
    const r = await fetch(`https://api.retellai.com/v2/get-call/${callId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!r.ok) return null
    return (await r.json()) as RetellCallRaw
  } catch {
    return null
  }
}

async function fetchSupabaseQualForLead(leadId: string): Promise<string | null> {
  const { getSupabaseServer } = await import('@/lib/supabase')
  const supabase = getSupabaseServer()
  if (!supabase) return null
  const { data } = await supabase
    .from('leads_rdv')
    .select('qualification')
    .eq('id', leadId)
    .maybeSingle()
  return (data?.qualification as string | undefined) ?? null
}

export async function POST(request: Request) {
  if (!anthropicConfigured()) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY n'est pas configurée. Ajoute-la dans Vercel puis redéploie.",
      },
      { status: 503 }
    )
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const callIds = Array.isArray(body.callIds) ? body.callIds.filter((x) => typeof x === 'string') : []
  if (callIds.length === 0) {
    return NextResponse.json({ data: [] as ReclassifyResult[] })
  }
  if (callIds.length > 30) {
    return NextResponse.json(
      { error: 'Maximum 30 appels par requête. Affine le filtre puis relance.' },
      { status: 400 }
    )
  }

  const client = getAnthropic()!
  const results: ReclassifyResult[] = []

  for (const callId of callIds) {
    const detail = await fetchCallDetail(callId)
    if (!detail) {
      results.push({
        callId,
        retellOutcome: null,
        supabaseQualification: null,
        claudeSuggestion: 'PAS DE REPONSE',
        leadId: null,
      })
      continue
    }
    const transcript =
      detail.transcript ??
      (Array.isArray(detail.transcript_object)
        ? detail.transcript_object
            .map((t) => `${t.role ?? '?'}: ${t.content ?? ''}`)
            .join('\n')
        : '')
    const durationSeconds = Math.round((detail.duration_ms ?? 0) / 1000)
    const retellOutcome =
      detail.call_analysis?.custom_analysis_data?.call_outcome ?? null
    const leadId = detail.metadata?.lead_id ?? null
    const supabaseQual = leadId ? await fetchSupabaseQualForLead(leadId) : null

    const userText = [
      `Durée : ${durationSeconds}s`,
      `Retell call_outcome : ${retellOutcome ?? 'n/a'}`,
      `Supabase qualification actuelle : ${supabaseQual ?? 'n/a'}`,
      '',
      'Transcription :',
      transcript ? transcript.slice(0, 8000) : '(transcription indisponible)',
    ].join('\n')

    try {
      const res = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 32,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userText }],
      })
      const textBlock = res.content.find((b) => b.type === 'text')
      const raw =
        textBlock && textBlock.type === 'text' ? textBlock.text : ''
      results.push({
        callId,
        retellOutcome,
        supabaseQualification: supabaseQual,
        claudeSuggestion: pickLabel(raw),
        leadId,
      })
    } catch (err) {
      console.error('Claude reclassify failed', callId, err)
      results.push({
        callId,
        retellOutcome,
        supabaseQualification: supabaseQual,
        claudeSuggestion: 'PAS DE REPONSE',
        leadId,
      })
    }
  }

  return NextResponse.json({ data: results })
}
