import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export const dynamic = 'force-dynamic'

// `origin` captures how each document is obtained, which drives the status label
// shown in the checklist:
//   patient   — supplied by the patient (Pending → Received)
//   signature — produced by the clinic and sent out for signature, then returned
//               (Awaiting signature → Signed); NOT received from the patient
export const NHS_DOCS = [
  { key: 'doc_nhs_s2_form',               required: true,  origin: 'patient'   },
  { key: 'doc_s2_provider_declaration',   required: true,  origin: 'signature' },
  { key: 'doc_cpam_certificate',          required: true,  origin: 'patient'   },
  { key: 'doc_clinical_justification_gp', required: true,  origin: 'patient'   },
  { key: 'doc_medical_report',            required: true,  origin: 'patient'   },
  { key: 'doc_undue_delay_letter',        required: true,  origin: 'patient'   },
  { key: 'doc_patient_authorisation',     required: true,  origin: 'patient'   },
  { key: 'doc_identity_document',         required: true,  origin: 'patient'   },
  { key: 'doc_proof_of_residence',        required: true,  origin: 'patient'   },
  { key: 'doc_bank_statements',           required: false, origin: 'patient'   },
  { key: 'doc_detailed_medical_estimate', required: true,  origin: 'signature' },
] as const

type DossierRow = Record<string, unknown> & {
  id: string
  lead_id: string | null
  dossier_status: string | null
  submission_ready: boolean | null
  nhs_submission_status: string | null
  bank_statement_exception: boolean | null
  last_analysed_at: string | null
}

type LeadRow = {
  id: string
  nom: string | null
  email: string | null
  numero_telephone: string | null
  patient_dob: string | null
  email_sent: boolean | null
  whatsapp_sent: boolean | null
  relance_email_sent: boolean | null
  relance_whatsapp_sent: boolean | null
  relance_email_date: string | null
  last_response_date: string | null
  last_call_datetime: string | null
  last_updated: string | null
}

export interface NhsPatient {
  id: string
  lead_id: string
  name: string | null
  initials: string
  age: number | null
  email: string | null
  phone: string | null
  status: 'complets' | 'partiels' | 'sans-reponse' | 'aucun-doc' | 'envoye-nhs'
  docs_received: number
  docs_required: number
  last_activity: string | null
  nhs_status: string | null
  escalade: boolean
  no_response: boolean
  bank_exception: boolean
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

function initialsOf(name: string | null): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '—'
}

function countDocs(d: DossierRow): { received: number; required: number } {
  let received = 0
  const required = NHS_DOCS.filter(x => x.required).length
  for (const doc of NHS_DOCS) {
    if (!doc.required) continue
    if (d[doc.key] === 'received') received++
  }
  return { received, required }
}

function deriveStatus(
  d: DossierRow,
  l: LeadRow,
  received: number,
  threeDaysAgo: Date,
): NhsPatient['status'] {
  if (d.dossier_status === 'SUBMITTED' || d.nhs_submission_status != null) return 'envoye-nhs'
  if (d.dossier_status === 'COMPLETE' || d.dossier_status === 'READY_TO_SUBMIT' || d.submission_ready) {
    return 'complets'
  }
  const noResponse =
    !!l.email_sent &&
    !l.last_response_date &&
    !!l.relance_email_sent &&
    !!l.relance_email_date &&
    new Date(l.relance_email_date) < threeDaysAgo
  if (noResponse) return 'sans-reponse'
  // Key off the dossier_status enum the stats panel uses, so list filters
  // agree with the dashboard counts. Fall back to the received-doc count.
  if (d.dossier_status === 'NO_DOCUMENTS_RECEIVED') return 'aucun-doc'
  if (d.dossier_status === 'MISSING_DOCUMENTS') return 'partiels'
  if (received === 0) return 'aucun-doc'
  return 'partiels'
}

export function buildPatient(d: DossierRow, l: LeadRow, threeDaysAgo: Date): NhsPatient {
  const { received, required } = countDocs(d)
  const status = deriveStatus(d, l, received, threeDaysAgo)
  const lastActivity =
    d.last_analysed_at ||
    l.last_response_date ||
    l.relance_email_date ||
    l.last_call_datetime ||
    l.last_updated ||
    null

  return {
    id: d.id,
    lead_id: l.id,
    name: l.nom,
    initials: initialsOf(l.nom),
    age: ageFromDob(l.patient_dob),
    email: l.email,
    phone: l.numero_telephone,
    status,
    docs_received: received,
    docs_required: required,
    last_activity: lastActivity,
    nhs_status: d.nhs_submission_status,
    escalade: status === 'sans-reponse',
    // Contacted (email / WhatsApp / call) but no reply yet and no documents in.
    // Broader than the 3-day escalation flag — used by the "No response" filter.
    no_response:
      (!!l.email_sent || !!l.whatsapp_sent || l.last_call_datetime != null) &&
      !l.last_response_date &&
      received === 0,
    bank_exception: !!d.bank_statement_exception,
  }
}

// Synthetic empty dossier for an emailed lead that has no dossier row yet, so
// such patients still appear (as "no document") and reconcile with the overview.
export function emptyDossier(leadId: string): DossierRow {
  return {
    id: leadId,
    lead_id: leadId,
    dossier_status: null,
    submission_ready: null,
    nhs_submission_status: null,
    bank_statement_exception: null,
    last_analysed_at: null,
  }
}

export async function GET() {
  try {
    const sb = getSupabase()
    const docCols = NHS_DOCS.map(d => d.key).join(', ')

    const [dossiersRes, leadsRes] = await Promise.all([
      sb
        .from('nhs_dossiers')
        .select(
          `id, lead_id, dossier_status, submission_ready, nhs_submission_status,
           bank_statement_exception, last_analysed_at, ${docCols}`,
        ),
      sb
        .from('leads_rdv')
        .select(
          'id, nom, email, numero_telephone, patient_dob, email_sent, whatsapp_sent,' +
            ' relance_email_sent, relance_whatsapp_sent, relance_email_date,' +
            ' last_response_date, last_call_datetime, last_updated',
        )
        .not('email', 'is', null)
        .is('raison_ne_pas_rappeler', null),
    ])

    const dossiers = (dossiersRes.data ?? []) as DossierRow[]
    const leads = (leadsRes.data ?? []) as LeadRow[]
    const dossierByLead = new Map(
      dossiers.filter(d => d.lead_id != null).map(d => [d.lead_id as string, d]),
    )

    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    // Build the list over the emailed-lead population so it reconciles with the
    // overview file-status counts: an emailed lead with no dossier (or an empty
    // one) is shown as a "no document" patient rather than being dropped.
    const patients: NhsPatient[] = []
    for (const l of leads) {
      if (!l.email_sent) continue
      const d = dossierByLead.get(l.id) ?? emptyDossier(l.id)
      patients.push(buildPatient(d, l, threeDaysAgo))
    }

    patients.sort((a, b) => {
      const escDiff = Number(b.escalade) - Number(a.escalade)
      if (escDiff !== 0) return escDiff
      const ta = a.last_activity ? new Date(a.last_activity).getTime() : 0
      const tb = b.last_activity ? new Date(b.last_activity).getTime() : 0
      return tb - ta
    })

    return NextResponse.json({ patients })
  } catch (err) {
    console.error('[nhs-patients]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
