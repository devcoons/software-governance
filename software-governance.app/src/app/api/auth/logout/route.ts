/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { logout } from '@/server/auth/service'
import { readSid, readRid, applyCookies, buildClearAuthCookies } from '@/server/http/cookie'

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  const r = await logout({ sid: readSid(req), rid: readRid(req) })
  const res = NextResponse.json(r)
  applyCookies(res, buildClearAuthCookies())
  return res
}
