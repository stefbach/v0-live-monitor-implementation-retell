import { NextResponse } from 'next/server'
import { fetchErrors, resolveError } from '@/lib/dashboard'
import type { ApiResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const data = await fetchErrors()
    return NextResponse.json({ data, timestamp: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json(
      {
        data: [],
        error: e instanceof Error ? e.message : 'Erreur',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const body = (await request.json()) as { id?: string; action?: string }
    if (body.action === 'resolve' && body.id) {
      const res = await resolveError(body.id)
      return NextResponse.json(
        { data: res, timestamp: new Date().toISOString() },
        { status: res.ok ? 200 : 500 }
      )
    }
    return NextResponse.json(
      {
        data: null,
        error: 'Action inconnue',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    )
  } catch (e) {
    return NextResponse.json(
      {
        data: null,
        error: e instanceof Error ? e.message : 'Erreur',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
