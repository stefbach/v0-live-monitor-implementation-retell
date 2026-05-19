import { getSupabaseServer } from './supabase'

// Read/write helpers for the operational dashboard tables:
//   - dashboard_assignments : leads handed to a human (Rain / Summer)
//   - dashboard_errors      : system error / anomaly log

export interface DashboardAssignment {
  id: string
  lead_id: string
  assigned_to: string
  reason: string | null
  assigned_at: string | null
  assigned_by: string | null
  status: string | null
}

export interface DashboardError {
  id: string
  error_type: string
  lead_id: string | null
  call_id: string | null
  detail: string | null
  status: string | null
  created_at: string | null
  resolved_at: string | null
}

export async function fetchAssignments(): Promise<DashboardAssignment[]> {
  const supabase = getSupabaseServer()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('dashboard_assignments')
    .select('*')
    .order('assigned_at', { ascending: false })
    .limit(2000)
  if (error || !data) return []
  return data as DashboardAssignment[]
}

export async function fetchErrors(): Promise<DashboardError[]> {
  const supabase = getSupabaseServer()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('dashboard_errors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error || !data) return []
  return data as DashboardError[]
}

export async function createAssignment(input: {
  leadId: string
  assignedTo: string
  reason?: string | null
  assignedBy?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServer()
  if (!supabase) return { ok: false, error: 'Supabase non configuré' }
  const { error } = await supabase.from('dashboard_assignments').insert({
    lead_id: input.leadId,
    assigned_to: input.assignedTo,
    reason: input.reason ?? null,
    assigned_by: input.assignedBy ?? null,
    assigned_at: new Date().toISOString(),
    status: 'open',
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function resolveError(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServer()
  if (!supabase) return { ok: false, error: 'Supabase non configuré' }
  const { error } = await supabase
    .from('dashboard_errors')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function logDashboardError(input: {
  errorType: string
  leadId?: string | null
  callId?: string | null
  detail?: string | null
}): Promise<void> {
  const supabase = getSupabaseServer()
  if (!supabase) return
  await supabase.from('dashboard_errors').insert({
    error_type: input.errorType,
    lead_id: input.leadId ?? null,
    call_id: input.callId ?? null,
    detail: input.detail ?? null,
    status: 'open',
    created_at: new Date().toISOString(),
  })
}
