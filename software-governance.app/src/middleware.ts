/* ---------------------------------------------------------------------- */
/* Filepath: src/middleware.ts */
/* ---------------------------------------------------------------------- */

import appConfig from '@/config.e'
import { NextRequest, NextResponse } from 'next/server'

/* ---------------------------------------------------------------------- */

const LOGIN_PATH  = '/login'
const BRIDGE_PATH = '/api/session-bridge'

const ASSET_RE = /\.(?:js|mjs|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|map)$/i

type HealthCache = { ts: number; ok: boolean }

const g = globalThis as { __EDGE_HEALTH__?: HealthCache }
let edgeHealthCache: HealthCache | null = g.__EDGE_HEALTH__ ?? null

/* ---------------------------------------------------------------------- */

function isApi(pathname: string)            { return pathname.startsWith('/api/') }
function isNextInternal(pathname: string)   { return pathname.startsWith('/_next') }
function isAsset(pathname: string)          { return ASSET_RE.test(pathname) }

/* ---------------------------------------------------------------------- */

function isPublic(pathname: string): boolean {
  return appConfig.URL_PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))
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
        const url = new URL('/api/health', req.url)
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

export function sanitizeNext(input: unknown): string {
    const raw = String(input ?? '').trim()
    if (raw.length === 0) return '/'
    if (!raw.startsWith('/')) return '/'
    if (raw.startsWith('//')) return '/'   /* network-path ref → reject */
    if (raw.includes('\\') || /[\u0000-\u001F]/.test(raw)) return '/'
    return raw
}

/* ---------------------------------------------------------------------- */

export async function middleware(req: NextRequest) {
	const { nextUrl, cookies } = req
    const pathname = nextUrl.pathname

    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-url', req.nextUrl.pathname + req.nextUrl.search)


    if (pathname === '/maintenance')
        return NextResponse.next()

    if (pathname === BRIDGE_PATH)                 
        return NextResponse.next()

    if (isApi(pathname) || isNextInternal(pathname) || isAsset(pathname)) {
        return NextResponse.next({request: { headers: requestHeaders }})
    }

    const healthy = await checkHealth(req)
    console.log('[MW] Health status:', healthy ? 'healthy' : 'unhealthy')
    if (!healthy) {
        const next = sanitizeNext(req.nextUrl.pathname + req.nextUrl.search)
        const maintenance = new URL(`/maintenance?next=${encodeURIComponent(next)}`, req.url)
        console.log('[MW] Redirecting to maintenance page:', maintenance.toString())
        return NextResponse.redirect(maintenance)
    }

    const sid = cookies.get(appConfig.SESSION_COOKIE)?.value ?? null
    const rid = cookies.get(appConfig.REFRESH_COOKIE)?.value ?? null

    const rememberPath = () => {
        if (req.method !== 'GET') return NextResponse.next()
        const res = NextResponse.next()
        res.cookies.set('__last_path', pathname + nextUrl.search, { path: '/', sameSite: 'lax', maxAge: 60 })
        return res
    }

    if (isPublic(pathname)) {

        if(sid && pathname === LOGIN_PATH)
        {
            const login = nextUrl.clone()
            login.pathname = '/dashboard'
            const res = NextResponse.redirect(login)
            res.headers.set('Cache-Control', 'no-store')
            res.headers.set('x-url', req.nextUrl.pathname + req.nextUrl.search)
            return res
        }
        return rememberPath()
    }

    if (sid) {
         console.log('[MIDDLE] - Jumping to:',pathname)
        return NextResponse.next({request: { headers: requestHeaders }})

    }

    if (rid) {
        const to = nextUrl.clone()
        to.pathname = BRIDGE_PATH
        to.searchParams.set('next', pathname + nextUrl.search)
        to.searchParams.set('__bridged', '1') // harmless hint
        const res = NextResponse.redirect(to)
        res.headers.set('Cache-Control', 'no-store')
        res.headers.set('x-url', req.nextUrl.pathname + req.nextUrl.search)
        return res
    }

    const login = nextUrl.clone()
    login.pathname = LOGIN_PATH
    login.searchParams.set('next', pathname + nextUrl.search)
    const res = NextResponse.redirect(login)
    res.headers.set('Cache-Control', 'no-store')
    res.headers.set('x-url', req.nextUrl.pathname + req.nextUrl.search)
    return res        
 
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */