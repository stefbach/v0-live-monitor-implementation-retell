import { NextResponse, type NextRequest } from 'next/server'
import {
  AUTH_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  passwordsMatch,
  signSession,
} from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected) {
    return NextResponse.json(
      { error: 'DASHBOARD_PASSWORD not configured on the server.' },
      { status: 500 }
    )
  }

  let body: { password?: string } = {}
  try {
    body = (await req.json()) as { password?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.password || !passwordsMatch(body.password, expected)) {
    // Small delay to slow down naive brute force.
    await new Promise((r) => setTimeout(r, 400))
    return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 })
  }

  const token = await signSession()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
  return res
}
