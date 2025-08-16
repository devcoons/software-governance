/* ---------------------------------------------------------------------- */
/* src/app/api/auth/session/bridge/route.ts */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { refresh } from '@/server/auth/service'
import { readRid, applyCookies, buildAuthCookies } from '@/server/http/cookie'
import { sanitizeNext } from '@/server/http/next'

/* ---------------------------------------------------------------------- */

function nextLocation(req: NextRequest): string {
    const url = new URL(req.url)
    const raw = url.searchParams.get('next') || '/'
    const safe = sanitizeNext(raw)
    return safe || '/'
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
        const r = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.url), 303)
        r.headers.set('x-trace-id', trace)
        return r
    }

    console.log('[BRIDGE]', trace, 'Calling refresh() with RID:', rid)
    const result = await refresh(req, rid)
    console.log('[BRIDGE]', trace, 'Refresh result:', result)

    if (!result.ok) {
        // Common case: concurrent refresh rotated the RID in another request.
        // Do NOT send to login; let the next hop see the (likely) fresh cookies.
        console.log('[BRIDGE]', trace, 'Refresh failed → redirect back to next (race-safe)')
        const r = NextResponse.redirect(new URL(next, req.url), 303)
        r.headers.set('x-trace-id', trace)
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
    return res
}


/* ---------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
    return handle(req)
}

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
    // Middleware may 307 a POST here; treat identically and then 303 back to GET.
    return handle(req)
}

/* ---------------------------------------------------------------------- */
