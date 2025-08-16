/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { read as readSession } from '@/server/auth/reader'
import { findUserById, updateUserPassword } from '@/server/db/user-repo'
import { verifyPassword, hashPassword } from '@/server/crypto/password'
import { store } from '@/server/session/provider'
import { newSession } from '@/server/session/utils'
import { applyCookies, buildAuthCookies, readRid } from '@/server/http/cookie'
import { newRefresh } from '@/server/session/utils'
import { getUaHash, getIpHint } from '@/server/auth/ua-ip'
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
  // Revoke all refresh tokens; mint a fresh one for current device
  const oldRid = readRid(req)
  const oldRec = oldRid ? await store.getRefresh(oldRid) : null
  await store.revokeUserRefresh(user.id)
  const freshRid = newRefresh({
    userId: user.id,
    rememberMe: Boolean(oldRec?.remember_me),
    uaHash: getUaHash(req),
    ipHint: getIpHint(req),
  })
  await store.putRefresh(freshRid)

  const claims = { ...sess.claims, force_password_change: false }
  const next = newSession(user.id, claims)

  await store.putSession(next)
  await store.revokeUserSessions(user.id, next.sid)

    const res = NextResponse.json({ ok: true })
    applyCookies(res, buildAuthCookies({ sid: next.sid, rid: freshRid.rid, rememberMe: Boolean(oldRec?.remember_me) }))
    return res
}
