/* ---------------------------------------------------------------------- */
/* Filepath: src/app/api/(public)/session-bridge/route.ts */
/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { queueCookie, withCookieContext } from '@/server/http/cookie-finalizer'
import { getAndRefreshCurrentSession } from '@/server/auth/ctx'
import { BRIDGE_GUARD_COOKIE, encodeGuard, evalBridgeGuard } from './_lib' 

/* ---------------------------------------------------------------------- */

const baseOpts = { path: '/', sameSite: 'lax' as const, secure: true }
const sidOpts = { httpOnly: true, sameSite: 'lax' as const, secure: true, path: '/' }
const ridOpts = { httpOnly: true, sameSite: 'lax' as const, secure: true, path: '/' }

/* ---------------------------------------------------------------------- */

export const GET = withCookieContext(async (req: NextRequest) => {
    const url = new URL(req.url)
    const next = url.searchParams.get('next') || '/'

    const { shouldBlock, nextState } = evalBridgeGuard(req)
    const hasGuard = !!req.cookies.get(BRIDGE_GUARD_COOKIE)?.value

    if (shouldBlock) {
        const to = new URL('/login', url.origin)
        to.searchParams.set('reason', 'bridge_loop')
        const res = NextResponse.redirect(to, 302)
        res.cookies.set(BRIDGE_GUARD_COOKIE, '', { ...baseOpts, maxAge: 0 })
        res.cookies.set('sid', '', { ...baseOpts, httpOnly: true, maxAge: 0 })
        res.cookies.set('rid', '', { ...baseOpts, httpOnly: true, maxAge: 0 })
        res.headers.set('Cache-Control', 'no-store')
        return res
    }

    const rc = await getAndRefreshCurrentSession(req)
    console.log(rc)
    if (!rc) {
        if (!hasGuard) {
            queueCookie({
                name: BRIDGE_GUARD_COOKIE,
                value: encodeGuard(nextState),
                options: { ...baseOpts, httpOnly: true, maxAge: Math.ceil(10_000 / 1000) },
            })
        } else {
            queueCookie({ name: BRIDGE_GUARD_COOKIE, value: '', options: { ...baseOpts, maxAge: 0 } })
        }
        queueCookie({ name: 'sid', value: '', options: { ...sidOpts, maxAge: 0 } })
        queueCookie({ name: 'rid', value: '', options: { ...ridOpts, maxAge: 0 } })
        const to = new URL('/login', url.origin)
        to.searchParams.set('reason', "unknown_error")
        console.log("Not rc")
        return NextResponse.redirect(to, 302)
    }

    if (!rc.ok) {
        if (!hasGuard) {
            queueCookie({
                name: BRIDGE_GUARD_COOKIE,
                value: encodeGuard(nextState),
                options: { ...baseOpts, httpOnly: true, maxAge: Math.ceil(10_000 / 1000) },
        })
        } else {
            queueCookie({ name: BRIDGE_GUARD_COOKIE, value: '', options: { ...baseOpts, maxAge: 0 } })
        }
        queueCookie({ name: 'sid', value: '', options: { ...sidOpts, maxAge: 0 } })
        queueCookie({ name: 'rid', value: '', options: { ...ridOpts, maxAge: 0 } })
        const to = new URL('/login', url.origin)
        to.searchParams.set('reason', rc.error)
        console.log("Not rc.ok")
        return NextResponse.redirect(to, 302)
    }

    queueCookie({ name: BRIDGE_GUARD_COOKIE, value: '', options: { ...baseOpts, maxAge: 0 } })
    queueCookie({ name: 'sid', value: rc.sid, options: { ...sidOpts, maxAge: 60 * 60 } })
    queueCookie({ name: 'rid', value: rc.rid, options: { ...ridOpts, maxAge: 60 * 60 * 24 * 30 } })
    const rUrl = new URL(next, url.origin)
    console.log('------ REDIRECTING',rUrl)
    return NextResponse.redirect(rUrl, 302)
})

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */