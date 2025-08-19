/* ---------------------------------------------------------------------- */
/* Filepath: src/app/api/(public)/session-bridge/route.ts */
/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { queueCookie, withCookieContext } from '@/server/http/cookie-finalizer'
import { getAndRefreshCurrentSession } from '@/server/auth/ctx'

/* ---------------------------------------------------------------------- */

const baseOpts = { path: '/', sameSite: 'lax' as const, secure: true }
const sidOpts = { httpOnly: true, sameSite: 'lax' as const, secure: true, path: '/' }
const ridOpts = { httpOnly: true, sameSite: 'lax' as const, secure: true, path: '/' }

/* ---------------------------------------------------------------------- */

export const BRIDGE_GUARD_COOKIE = '__bridge_guard'
const WINDOW_MS = 7_000   // N seconds window
const MAX_HITS  = 3        // "twice in N seconds" → block on the 2nd hit

/* ---------------------------------------------------------------------- */

type GuardState = { rid: string; ts: number; count: number }

/* ---------------------------------------------------------------------- */

export function parseGuard(raw?: string | null): GuardState | null {
  if (!raw) return null
  const [rid, tsStr, countStr] = raw.split('|')
  const ts = Number(tsStr), count = Number(countStr)
  if (!rid || !Number.isFinite(ts) || !Number.isFinite(count)) return null
  return { rid, ts, count }
}

/* ---------------------------------------------------------------------- */

export function encodeGuard(s: GuardState): string {
  return `${s.rid}|${s.ts}|${s.count}`
}

/* ---------------------------------------------------------------------- */

export function evalBridgeGuard(req: NextRequest) {
  const now = Date.now()
  const sid = req.cookies.get('sid')?.value ?? null
  const rid = req.cookies.get('rid')?.value ?? ''

  const cur = parseGuard(req.cookies.get(BRIDGE_GUARD_COOKIE)?.value)
  const within = (cur && (now - cur.ts) <= WINDOW_MS) || false
  const sameRid = !!cur && cur.rid === rid

  const nextCount = sameRid && within ? (cur!.count + 1) : 1
  const nextState: GuardState = { rid, ts: now, count: nextCount }

  // Block if: no SID yet, same RID repeating, within window, and this is the 2nd hit (or more)
  const shouldBlock = !sid && sameRid && within && nextCount >= MAX_HITS

  return { shouldBlock, nextState }
}

/* ---------------------------------------------------------------------- */

export const GET = withCookieContext(async (req: NextRequest) => {
    const url = new URL(req.url)
    const next = url.searchParams.get('next') || '/'

    const { shouldBlock, nextState } = evalBridgeGuard(req)
    if (shouldBlock) {
        const to = new URL('/login', url.origin)
        to.searchParams.set('reason', 'bridge_loop')
        const res = NextResponse.redirect(to, 302)
        res.cookies.set(BRIDGE_GUARD_COOKIE, '', { ...baseOpts, maxAge: 0 })
        res.cookies.set('rid', '', { ...baseOpts, httpOnly: true, maxAge: 0 })
        res.headers.set('Cache-Control', 'no-store')
        return res
    }

    const rc = await getAndRefreshCurrentSession(req)

    if (!rc) {
        queueCookie({
            name: BRIDGE_GUARD_COOKIE,
            value: encodeGuard(nextState),
            options: { ...baseOpts, httpOnly: true, maxAge: Math.ceil(10_000/1000) }
        })
        const to = new URL('/login', url.origin)
        to.searchParams.set('reason', "unknown_error")
        return NextResponse.redirect(to, 302)
    }

    if (!rc.ok) {
        queueCookie({
            name: BRIDGE_GUARD_COOKIE,
            value: encodeGuard(nextState),
            options: { ...baseOpts, httpOnly: true, maxAge: Math.ceil(10_000/1000) }
        })
        const to = new URL('/login', url.origin)
        to.searchParams.set('reason', rc.error)
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