import { NextResponse } from 'next/server'
import { fetchAssignments, createAssignment } from '@/lib/dashboard'
import type { ApiResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const data = await fetchAssignments()
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
    const body = (await request.json()) as {
      leadId?: string
      assignedTo?: string
      reason?: string
      assignedBy?: string
    }
    if (!body.leadId || !body.assignedTo) {
      return NextResponse.json(
        {
          data: null,
          error: 'leadId et assignedTo requis',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }
    const res = await createAssignment({
      leadId: body.leadId,
      assignedTo: body.assignedTo,
      reason: body.reason ?? null,
      assignedBy: body.assignedBy ?? null,
    })
    return NextResponse.json(
      { data: res, timestamp: new Date().toISOString() },
      { status: res.ok ? 200 : 500 }
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
