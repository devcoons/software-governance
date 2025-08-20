// src/server/http/with-session.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCookieContext, queueCookie } from '@/server/http/cookie-finalizer'
import { getCurrentSession, getAndRefreshCurrentSession } from '@/server/auth/ctx'
import app from '@/config'

const base = { path: '/', sameSite: 'lax' as const, secure: true }
const sidOpts = { ...base, httpOnly: true }
const ridOpts = { ...base, httpOnly: true }

export type WithSessionResult =
  | { ok: true; session: import('@/server/auth/types').SessionRecord }
  | { ok: false; status: number; body: { ok: false; error: string } }

export function withSession<T extends (req: NextRequest, ctx: unknown, session: import('@/server/auth/types').SessionRecord) => Promise<Response>>(
  handler: T
) {
  return withCookieContext(async (req: NextRequest, ctx?: unknown) => {
    // 1) Fast path: current session from SID
    const ss = await getCurrentSession(req)
    if (ss) {
      return handler(req, ctx, ss)
    }

    const rc = await getAndRefreshCurrentSession(req)
    if (rc?.ok) {
      queueCookie({ name: app.SESSION_COOKIE, value: rc.sid, options: { ...sidOpts, maxAge: Number(app.SESSION_TTL_SECONDS) } })
      queueCookie({ name: app.REFRESH_COOKIE, value: rc.rid, options: { ...ridOpts, maxAge: Number(app.REFRESH_ABSOLUTE_TTL_SECONDS) } })

      const { redisStore } = await import('@/server/auth/redis') // avoid cycles
      const fresh = await redisStore.getSession(rc.sid)
      if (fresh) return handler(req, ctx, fresh)
      return NextResponse.json({ ok: false, error: 'session_unavailable_after_refresh' }, { status: 401 })
    }

    // 3) Cannot refresh → tell client to re-auth
    const reason = rc?.error ?? 'unauthorized'
    return NextResponse.json({ ok: false, error: reason }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  })
}
