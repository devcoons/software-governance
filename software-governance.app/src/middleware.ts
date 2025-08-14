/* middleware.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import appConfig from '@/config.e'

/* ---------------------------------------------------------------------- */

type HealthCache = { ts: number; ok: boolean }
const g = globalThis as any
let edgeHealthCache: HealthCache | null = g.__EDGE_HEALTH__ || null

/* ---------------------------------------------------------------------- */

function isAllowedPath(pathname: string): boolean {
  if (pathname === '/maintenance') return true
  if (appConfig.ALLOW_EXACT.includes(pathname)) return true
  for (const p of appConfig.ALLOW_PREFIXES) {
    if (pathname.startsWith(p)) return true
  }
  return false
}

/* ---------------------------------------------------------------------- */

function isProtectedPath(pathname: string): boolean {
  for (const p of appConfig.PROTECTED_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + '/')) return true
  }
  return false
}

/* ---------------------------------------------------------------------- */

function isPageNavigation(req: NextRequest): boolean {
  const mode = req.headers.get('sec-fetch-mode') || ''
  const dest = req.headers.get('sec-fetch-dest') || ''
  const accept = req.headers.get('accept') || ''
  const prefetch = req.headers.get('next-router-prefetch') === '1'
  if (prefetch) return false
  if (mode === 'navigate' || dest === 'document') return true
  if (accept.includes('text/html')) return true
  if (accept.includes('text/x-component')) return true
  return false
}

/* ---------------------------------------------------------------------- */

function edgeCacheFresh(): boolean {
  if (!edgeHealthCache) return false
  return Date.now() - edgeHealthCache.ts < appConfig.HEALTH_CACHE_MS
}

/* ---------------------------------------------------------------------- */

async function checkHealth(req: NextRequest): Promise<boolean> {
  if (edgeCacheFresh()) return edgeHealthCache!.ok
  try {
    const url = new URL('/api/health/ready', req.url)
    const res = await fetch(url, { cache: 'no-store' })
    const ok = res.ok
    edgeHealthCache = { ts: Date.now(), ok }
    g.__EDGE_HEALTH__ = edgeHealthCache
    return ok
  } catch {
    edgeHealthCache = { ts: Date.now(), ok: false }
    g.__EDGE_HEALTH__ = edgeHealthCache
    return false
  }
}

/* ---------------------------------------------------------------------- */

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  if (pathname.startsWith('/api/')) return NextResponse.next()
  if (isAllowedPath(pathname)) return NextResponse.next()
  if (!isPageNavigation(req)) return NextResponse.next()

  const healthy = await checkHealth(req)
  if (!healthy) {
    const url = req.nextUrl.clone()
    url.pathname = '/maintenance'
    url.search = ''
    url.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(url)
  }

  if (!isProtectedPath(pathname)) return NextResponse.next()

  const sid = req.cookies.get(appConfig.SESSION_COOKIE)?.value || ''
  if (sid) return NextResponse.next()

  const rid = req.cookies.get(appConfig.REFRESH_COOKIE)?.value || ''
  const url = req.nextUrl.clone()
  if (rid) {
    url.pathname = '/api/auth/session/bridge'
    url.search = ''
    url.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(url)
  }

  url.pathname = '/login'
  url.search = ''
  url.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(url)
}

/* ---------------------------------------------------------------------- */

export const config = {
  matcher: ['/((?!api|_next|static|assets).*)'],
}
