import { createAuthServerClient } from '@/lib/supabase-auth/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createAuthServerClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
