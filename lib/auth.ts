// Tiny HMAC-signed session cookie. Edge-compatible (Web Crypto only).
// One shared password lives in DASHBOARD_PASSWORD; cookie tokens are
// signed with DASHBOARD_AUTH_SECRET so they can't be forged client-side.

export const AUTH_COOKIE = 'occ_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function getSecret(): string {
  const secret = process.env.DASHBOARD_AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      'DASHBOARD_AUTH_SECRET is missing or too short (min 16 chars).'
    )
  }
  return secret
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  )
  return new Uint8Array(sig)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// Token format: <expiresAtMs>.<hmacBase64Url>
export async function signSession(): Promise<string> {
  const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  const payload = String(exp)
  const sig = await hmac(getSecret(), payload)
  return `${payload}.${base64UrlEncode(sig)}`
}

export async function verifySession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sigPart = token.slice(dot + 1)
  const exp = Number(payload)
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  try {
    const expected = await hmac(getSecret(), payload)
    const provided = base64UrlDecode(sigPart)
    return timingSafeEqual(expected, provided)
  } catch {
    return false
  }
}

export function passwordsMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}
