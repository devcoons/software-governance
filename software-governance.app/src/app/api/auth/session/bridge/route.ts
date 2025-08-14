/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { refresh } from '@/server/auth/service'
import { readRid, applyCookies, buildAuthCookies, buildClearAuthCookies } from '@/server/http/cookie'

/* ---------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get('next') || '/'
  const rid = readRid(req)

  if (!rid) {
    const r = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.url), 303)
    applyCookies(r, buildClearAuthCookies())
    return r
  }

  const result = await refresh(req, rid)
  if (!result.ok) {
    const r = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.url), 303)
    applyCookies(r, buildClearAuthCookies())
    return r
  }

  const res = NextResponse.redirect(new URL(next, req.url), 303)
  applyCookies(res, buildAuthCookies({ sid: result.sid, rid: result.rid, rememberMe: result.rememberMe }))
  return res
}
