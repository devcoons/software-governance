/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { read as readSession } from '@/server/auth/reader'
import { findUserById, updateUserPassword } from '@/server/db/user-repo'
import { verifyPassword, hashPassword } from '@/server/crypto/password'
import { store } from '@/server/session/provider'
import { newSession } from '@/server/session/utils'
import { applyCookies, buildAuthCookies } from '@/server/http/cookie'
import config from '@/config'

/* ---------------------------------------------------------------------- */

type Body = {
  currentPassword?: string
  newPassword?: string
}

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  const sess = await readSession(req)
  if (!sess) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  const currentPassword = String(body.currentPassword || '')
  const newPassword = String(body.newPassword || '')

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })
  }

  const user = await findUserById(sess.user_id)
  console.log(user)
  if (!user || !user.is_active) {
    return NextResponse.json({ ok: false, error: 'user_not_active' }, { status: 403 })
  }

  const ok = await verifyPassword(user.password, currentPassword)
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'invalid_current_password' }, { status: 403 })
  }

  const hash = await hashPassword(newPassword)

  await updateUserPassword(user.id, hash)

  const claims = { ...sess.claims, force_password_change: false }
  const next = newSession(user.id, claims)

  await store.putSession(next)
  await store.revokeUserSessions(user.id, next.sid)

  const res = NextResponse.json({ ok: true })

  const sidOnly = buildAuthCookies({ sid: next.sid, rid: 'ignore', rememberMe: false })
    .filter(c => c.name === config.SESSION_COOKIE)
  applyCookies(res, sidOnly)

  return res
}
