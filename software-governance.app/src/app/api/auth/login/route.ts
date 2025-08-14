/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { login } from '@/server/auth/service'
import { applyCookies, buildAuthCookies } from '@/server/http/cookie'

/* ---------------------------------------------------------------------- */

type Body = {
  login?: string
  password?: string
  rememberMe?: boolean
}

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  const loginId = String(body.login || '').trim()
  const password = String(body.password || '')
  const rememberMe = Boolean(body.rememberMe)

  if (!loginId || !password) {
    return NextResponse.json({ ok: false, error: 'missing_credentials' }, { status: 400 })
  }

  const result = await login(req, { login: loginId, password, rememberMe })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true, force_password_change: result.forcePasswordChange })
  applyCookies(res, buildAuthCookies({ sid: result.sid, rid: result.rid, rememberMe: result.rememberMe }))
  return res
}
