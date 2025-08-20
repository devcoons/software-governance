/* ---------------------------------------------------------------------- */
/* Filepath: /src/app/api/(public)/login/route.ts */
/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ---------------------------------------------------------------------- */

import app from '@/config'
import { NextRequest, NextResponse } from 'next/server'
import { withCookieContext, queueCookie } from '@/server/http/cookie-finalizer'
import { sanitizeNext, login as loginService } from '@/server/auth/ctx'

/* ---------------------------------------------------------------------- */

type LoginBody = {
    login: string
    password: string
    rememberMe?: boolean
}

/* ---------------------------------------------------------------------- */

const base = { path: '/', sameSite: 'lax' as const, secure: true }
const sidCookieName = app.SESSION_COOKIE ?? 'sid'
const ridCookieName = app.REFRESH_COOKIE ?? 'rid'

/* ---------------------------------------------------------------------- */

export const POST = withCookieContext(async (req: NextRequest) => {
    const url = new URL(req.url)
    const wantsRedirect = url.searchParams.get('redirect') === '1' || url.searchParams.has('next')
    const nextPath = sanitizeNext(url.searchParams.get('next'))

    let body: LoginBody
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
    }

    const login = (body.login ?? '').trim()
    const password = body.password ?? ''
    const rememberMe = !!body.rememberMe

    if (!login || !password) {
        return NextResponse.json({ ok: false, error: 'missing_credentials' }, { status: 400 })
    }

    const rc = await loginService(req, { login, password, rememberMe })

    if (!rc.ok) {
        return NextResponse.json({ ok: false, error: rc.error ?? 'invalid_credentials' }, { status: 401 })
    }

    const sidMaxAge = Math.max(1, Number(app.SESSION_TTL_SECONDS ?? 3600))

    queueCookie({
        name: sidCookieName,
        value: rc.sid,
        options: { ...base, httpOnly: true, maxAge: sidMaxAge },
    })

    // RID cookie: if rememberMe → absolute ttl, else session cookie (no maxAge)
    const ridOpts = { ...base, httpOnly: true } as const
    if (rc.rememberMe) {
        const abs = Math.max(1, Number(app.REFRESH_ABSOLUTE_TTL_SECONDS ?? 60 * 60 * 24 * 30))
        queueCookie({ name: ridCookieName, value: rc.rid, options: { ...ridOpts, maxAge: abs } })
    } else {
        queueCookie({ name: ridCookieName, value: rc.rid, options: { ...ridOpts } })
    }

    // Force no-store on auth responses (wrapper also sets it, this is belt & suspenders)
    if (wantsRedirect) {
        const res = NextResponse.redirect(new URL(nextPath || '/', url.origin), 303)
        res.headers.set('Cache-Control', 'no-store')
        return res
    }

    return NextResponse.json(
        {
            ok: true,
            sid: rc.sid,
            rid: rc.rid,
            rememberMe: rc.rememberMe,
            forcePasswordChange: rc.forcePasswordChange,
        },
        { headers: { 'Cache-Control': 'no-store' } },
    )
})

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
