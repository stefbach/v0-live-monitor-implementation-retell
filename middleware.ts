import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE, verifySession } from '@/lib/auth'

// Public paths — everything else requires a valid signed session cookie.
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  // Safety hatch: if the secret isn't configured yet on the deployment,
  // let traffic through rather than locking everyone out. The login page
  // will surface the config error if it ever loads.
  if (!process.env.DASHBOARD_AUTH_SECRET || !process.env.DASHBOARD_PASSWORD) {
    return NextResponse.next()
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value
  const ok = await verifySession(token)
  if (ok) return NextResponse.next()

  // API requests get a 401 (no redirect — the client handles it).
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', pathname + (req.nextUrl.search || ''))
  return NextResponse.redirect(url)
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)'],
}
