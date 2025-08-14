/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { refresh } from '@/server/auth/service'
import { readRid, applyCookies, buildAuthCookies, buildClearAuthCookies } from '@/server/http/cookie'

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  const rid = readRid(req)
  if (!rid) {
    const r = NextResponse.json({ ok: false, error: 'no_refresh' }, { status: 401 })
    applyCookies(r, buildClearAuthCookies())
    return r
  }

  const result = await refresh(req, rid)
  if (!result.ok) {
    const r = NextResponse.json({ ok: false, error: result.error }, { status: 401 })
    applyCookies(r, buildClearAuthCookies())
    return r
  }

  const res = NextResponse.json({ ok: true })
  applyCookies(res, buildAuthCookies({ sid: result.sid, rid: result.rid, rememberMe: result.rememberMe }))
  return res
}
