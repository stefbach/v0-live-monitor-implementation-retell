// Normalize a phone number to E.164-ish digits (with leading +) for matching.
// UK default since the clinic is UK-based; falls back to the input if unparseable.
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return ''
  const trimmed = String(input).trim()
  if (!trimmed) return ''

  // Strip everything except digits and a possible leading +
  const hasPlus = trimmed.startsWith('+')
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''

  if (hasPlus) return '+' + digits

  // 00 international prefix → +
  if (digits.startsWith('00')) return '+' + digits.slice(2)

  // UK local format: 07xxxxxxxxx → +447xxxxxxxxx
  if (digits.startsWith('0') && digits.length >= 10) {
    return '+44' + digits.slice(1)
  }

  // Already starts with country digits (e.g. 447...) — assume international
  return '+' + digits
}

// Pick the most likely "other party" number for an outbound call (to_number)
// or inbound (from_number).
export function pickCounterpartyNumber(
  direction: 'inbound' | 'outbound',
  fromNumber: string,
  toNumber: string
): string {
  return direction === 'inbound' ? fromNumber : toNumber
}
