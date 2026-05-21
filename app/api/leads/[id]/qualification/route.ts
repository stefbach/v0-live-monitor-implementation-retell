import { NextResponse } from 'next/server'
import { getSupabaseServer, supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ALLOWED = new Set([
  'NOUVEAU DOSSIER',
  'RDV MEDECIN',
  'PAS INTERESSE',
  'PAS DE REPONSE',
  'FAUX NUMERO',
  'NE PAS RAPPELER',
  'FOLLOW UP',
  'CALLBACK_SCHEDULED',
  'RAPPEL',
])

interface Body {
  qualification?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase not configured', timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
  const { id } = await params
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }
  const q = body.qualification?.trim()
  if (!q || !ALLOWED.has(q)) {
    return NextResponse.json(
      { error: `qualification non autorisée. Valeurs valides : ${[...ALLOWED].join(', ')}` },
      { status: 400 }
    )
  }
  const supabase = getSupabaseServer()!
  const { error } = await supabase
    .from('leads_rdv')
    .update({
      qualification: q,
      last_qualification_update: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true, leadId: id, qualification: q })
}
