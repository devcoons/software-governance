/* middleware.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import appConfig from '@/config.e'
import { sanitizeNext } from './server/http/next'

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
    // One header dump to help trace RSC/data vs doc
    console.log('[MW] Pathname:', pathname, 'Search:', search, {
        mode: req.headers.get('sec-fetch-mode'),
        dest: req.headers.get('sec-fetch-dest'),
        accept: req.headers.get('accept'),
        prefetch: req.headers.get('next-router-prefetch'),
    })

    // Skip API routes
    if (pathname.startsWith('/api/')) {
        console.log('[MW] Skipping API path')
        return NextResponse.next()
    }

    // Allowlist
    if (isAllowedPath(pathname)) {
        console.log('[MW] Allowed path')
        return NextResponse.next()
    }

    // Health check
    const healthy = await checkHealth(req)
    console.log('[MW] Health status:', healthy ? 'healthy' : 'unhealthy')
    if (!healthy) {
        const next = sanitizeNext(req.nextUrl.pathname + req.nextUrl.search)
        const maintenance = new URL(`/maintenance?next=${encodeURIComponent(next)}`, req.url)
        console.log('[MW] Redirecting to maintenance page:', maintenance.toString())
        return NextResponse.redirect(maintenance)
    }

    // Gate protected paths (no pass-through for RSC/data)
    const protectedPath = isProtectedPath(pathname)
    console.log('[MW] Protected path:', protectedPath ? 'yes' : 'no')
    if (!protectedPath) {
        return NextResponse.next()
    }

    // Check session cookie
    const sid = req.cookies.get(appConfig.SESSION_COOKIE)?.value || ''
    console.log('[MW] SID cookie:', sid ? 'present' : 'missing')
    if (sid) {
        console.log('[MW] Valid SID, proceeding')
        return NextResponse.next()
    }

    // Check refresh cookie
    const rid = req.cookies.get(appConfig.REFRESH_COOKIE)?.value || ''
    console.log('[MW] RID cookie:', rid ? 'present' : 'missing')

    const next = sanitizeNext(req.nextUrl.pathname + req.nextUrl.search)

    if (rid) {
        console.log('[MW] SID missing but RID present → redirecting to bridge for refresh')
        const bridge = new URL(`/api/auth/session/bridge?next=${encodeURIComponent(next)}`, req.url)
        console.log('[MW] Bridge URL:', bridge.toString())
        // 307 is fine (preserves method); bridge returns 303 back to target
        return NextResponse.redirect(bridge, { status: 307 })
    }

    // No SID or RID → redirect to login
    console.log('[MW] No SID or RID → redirecting to login')
    const login = new URL(`/login?next=${encodeURIComponent(next)}`, req.url)
    console.log('[MW] Login URL:', login.toString())
    return NextResponse.redirect(login, { status: 303 })
}

/* ---------------------------------------------------------------------- */

export const config = {
    matcher: ['/((?!api|_next|static|assets).*)'],
}
