/* ---------------------------------------------------------------------- */
/* src/app/api/auth/session/bridge/route.ts */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { refresh } from '@/server/auth/service'
import { readRid, applyCookies, buildAuthCookies } from '@/server/http/cookie'
import { sanitizeNext } from '@/server/http/next'
import config from '@/config' // ⬅️ added

/* ---------------------------------------------------------------------- */

function nextLocation(req: NextRequest): string {
  const url = new URL(req.url)
  const raw = url.searchParams.get('next') ?? '/'
  const safe = sanitizeNext(raw)
  return safe ?? '/'
}

/* Terminal failures should disconnect the user (clear cookies -> login) */
const DISCONNECT_ERRORS = new Set([
  'ip_mismatch',
  'rotation_failed',
  'family_revoked',
  'reused',
  'not_found',
  'expired',
  'ua_mismatch'
])

/* Clear SID/RID cookies and 303 to /login?next=... */
function redirectToLoginClearingCookies(
  req: NextRequest,
  next: string,
  trace: string,
  reason?: string
): NextResponse {
  const loginUrl = new URL(`/login?next=${encodeURIComponent(next)}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`, req.url)
  const r = NextResponse.redirect(loginUrl, 303)

  // hard-delete both cookies
  r.cookies.set({
    name: config.SESSION_COOKIE,
    value: '',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
  })
  r.cookies.set({
    name: config.REFRESH_COOKIE,
    value: '',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
  })

  r.headers.set('x-trace-id', trace)
  r.headers.set('Pragma', 'no-cache')
  r.headers.set('Expires', '0')
  r.headers.set('Vary', 'Cookie')
  return r
}

/* ---------------------------------------------------------------------- */

async function handle(req: NextRequest): Promise<Response> {
  const next = nextLocation(req)
  const trace = req.headers.get('x-trace-id') ?? 'no-trace'
  console.log('[BRIDGE]', trace, 'next:', next)

  const rid = readRid(req)
  console.log('[BRIDGE]', trace, 'RID cookie:', rid ? 'present' : 'missing')

  if (!rid) {
    console.log('[BRIDGE]', trace, 'No RID → redirect to login')
    return redirectToLoginClearingCookies(req, next, trace)
  }

  console.log('[BRIDGE]', trace, 'Calling refresh() with RID:', rid)
  const result = await refresh(req, rid)
  console.log('[BRIDGE]', trace, 'Refresh result:', result)

  if (!result.ok) {
    // If this is a policy/terminal failure → disconnect user (break the loop)
    if (DISCONNECT_ERRORS.has(result.error as string)) {
      console.log('[BRIDGE]', trace, `Refresh failed (${result.error}) → clear cookies and go to login`)
      return redirectToLoginClearingCookies(req, next, trace, String(result.error))
    }

    // Common race: another request already rotated RID → bounce back and let new cookies (if any) take effect
    console.log('[BRIDGE]', trace, 'Refresh failed → redirect back to next (race-safe)')
    const r = NextResponse.redirect(new URL(next, req.url), 303)
    r.headers.set('x-trace-id', trace)
    r.headers.set('Pragma', 'no-cache')
    r.headers.set('Expires', '0')
    r.headers.set('Vary', 'Cookie')
    return r
  }

  console.log('[BRIDGE]', trace, 'Refresh OK → set new SID/RID and redirect to next')
  const res = NextResponse.redirect(new URL(next, req.url), 303)
  applyCookies(
    res,
    buildAuthCookies({
      sid: result.sid!,
      rid: result.rid!,
      rememberMe: result.rememberMe === true,
    }),
  )
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('x-trace-id', trace)
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  res.headers.set('Vary', 'Cookie')
  return res
}

/* ---------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  // Middleware may 307 a POST here; treat identically and then 303 back to GET.
  return handle(req)
}

/* ---------------------------------------------------------------------- */
