/* ---------------------------------------------------------------------- */
/* Filepath: src/app/api/(public)/session-bridge/route.ts */
/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { withCookieContext, queueCookie } from '@/server/http/cookie-finalizer'
import app from '@/config'
import { logout } from '@/server/auth/ctx'

/* ---------------------------------------------------------------------- */

const baseOpts = { path: '/', sameSite: 'lax' as const, secure: true }

/* ---------------------------------------------------------------------- */

export const POST = withCookieContext(async (req: NextRequest) => {
    const mode = (new URL(req.url).searchParams.get('mode') as 'device' | 'all') ?? 'device'
    const rc = await logout(req, mode)

    // Always clear browser cookies for the current jar
    queueCookie({ name: app.SESSION_COOKIE, value: '', options: { ...baseOpts, httpOnly: true, maxAge: 0 } })
    queueCookie({ name: app.REFRESH_COOKIE, value: '', options: { ...baseOpts, httpOnly: true, maxAge: 0 } })
    // Optional: clear any non-HttpOnly hints you set (e.g., sid_hint)
    queueCookie({ name: 'sid_hint', value: '', options: { ...baseOpts, maxAge: 0 } })

    if (!rc.ok) {
        return NextResponse.json(rc, { status: 200 }) // app can redirect client to /login
    }
    return NextResponse.json(rc, { status: 200 })
})

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */