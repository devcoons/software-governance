/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { readSid, applyCookies, buildAuthCookies } from '@/server/http/cookie'
import { store } from '@/server/session/provider'
import { hashPassword } from '@/server/crypto/password'
import { completeForcedPasswordChange, findUserById } from '@/server/db/user-repo'
import { claimsFromDbUser } from '@/server/session/claims'
import { newSession } from '@/server/session/utils'
import config from '@/config'

/* ---------------------------------------------------------------------- */

type Body = {
  newPassword?: string
  confirm?: string
}

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  const newPassword = String(body.newPassword || '')
  const confirm = String(body.confirm || '')
  if (!newPassword || newPassword !== confirm) {
    return NextResponse.json({ ok: false, error: 'password_mismatch' }, { status: 400 })
  }

  const sid = readSid(req)
  if (!sid) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })

  const sess = await store.getSession(sid)
  if (!sess) return NextResponse.json({ ok: false, error: 'invalid_session' }, { status: 401 })

  if (!sess.claims.force_password_change) {
    return NextResponse.json({ ok: false, error: 'not_forced' }, { status: 400 })
  }

  const user = await findUserById(sess.user_id)
  if (!user || !user.is_active) {
    return NextResponse.json({ ok: false, error: 'user_not_active' }, { status: 401 })
  }

  const hash = await hashPassword(newPassword)

  await completeForcedPasswordChange(user.id, hash)

  await store.revokeUserSessions(user.id, sid)

  const updatedClaims = {
    ...sess.claims,
    force_password_change: false,
    temp_password_issued_at: null,
    temp_password_used_at: null,
  }

  const next = newSession(user.id, updatedClaims)

  await store.deleteSession(sid)
  await store.putSession(next)

  const res = NextResponse.json({ ok: true })

  const sidOnly = buildAuthCookies({ sid: next.sid, rid: 'ignore', rememberMe: false })
    .filter(c => c.name === config.SESSION_COOKIE)
  applyCookies(res, sidOnly)

  return res
}
