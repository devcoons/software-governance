/* service.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import config from '@/config'
import { store } from '@/server/session/provider'
import { findUserByLogin, findUserById, burnTempPassword } from '@/server/db/user-repo'
import { verifyPassword, hashPassword } from '@/server/crypto/password'
import { claimsFromDbUser } from '@/server/session/claims'
import { newSession, newRefresh } from '@/server/session/utils'
import { getUaHash, getIpHint } from '@/server/auth/ua-ip'

/* ---------------------------------------------------------------------- */

export type LoginInput = {
  login: string
  password: string
  rememberMe: boolean
}

/* ---------------------------------------------------------------------- */

export type LoginResult =
  | { ok: true; sid: string; rid: string; rememberMe: boolean; forcePasswordChange: boolean }
  | { ok: false; error: string }

/* ---------------------------------------------------------------------- */

export async function login(req: NextRequest, input: LoginInput): Promise<LoginResult> {
  const user = await findUserByLogin(input.login)
  if (!user || !user.is_active) return { ok: false, error: 'invalid_credentials' }

  const passOk = await verifyPassword(user.password, input.password)
  if (!passOk) return { ok: false, error: 'invalid_credentials' }

  const isTempActive =
    user.force_password_change &&
    Boolean(user.temp_password_issued_at) &&
    !user.temp_password_used_at

  if (isTempActive) {
    const unusable = await hashPassword(`burn-${Date.now()}-${Math.random()}`)
    await burnTempPassword(user.id, unusable)
  }

  const claims = claimsFromDbUser(user)
  const uaHash = config.BIND_UA ? getUaHash(req) : ''
  const ipHint = getIpHint(req)

  const sidRec = newSession(user.id, claims)
  const ridRec = newRefresh({ userId: user.id, rememberMe: input.rememberMe, uaHash, ipHint })

  await store.putSession(sidRec)
  await store.putRefresh(ridRec)

  return {
    ok: true,
    sid: sidRec.sid,
    rid: ridRec.rid,
    rememberMe: input.rememberMe,
    forcePasswordChange: user.force_password_change,
  }
}

/* ---------------------------------------------------------------------- */

export type RefreshResult =
  | { ok: true; sid: string; rid: string; rememberMe: boolean }
  | { ok: false; error: string }

/* ---------------------------------------------------------------------- */

export async function refresh(req: NextRequest, rid: string): Promise<RefreshResult> {
  const rec = await store.getRefresh(rid)
  if (!rec) return { ok: false, error: 'invalid_refresh' }

  const now = Date.now()
  const absMs = Number(config.REFRESH_ABSOLUTE_TTL_SECONDS) * 1000
  const idleMs = Number(config.REFRESH_IDLE_TTL_SECONDS) * 1000

  if (rec.created_at + absMs <= now) return { ok: false, error: 'refresh_expired_absolute' }
  if (rec.last_used_at + idleMs <= now) return { ok: false, error: 'refresh_expired_idle' }

  const uaHash = config.BIND_UA ? getUaHash(req) : ''
  const ipHint = getIpHint(req)

  if (config.BIND_UA && uaHash !== rec.ua_hash) return { ok: false, error: 'ua_mismatch' }
  if (config.BIND_IP && ipHint && rec.ip_hint && ipHint !== rec.ip_hint) return { ok: false, error: 'ip_mismatch' }

  const user = await findUserById(rec.user_id)
  if (!user || !user.is_active) return { ok: false, error: 'user_not_active' }

  const claims = claimsFromDbUser(user)

  const nextRid = newRefresh({
    userId: rec.user_id,
    rememberMe: rec.remember_me,
    uaHash: rec.ua_hash,
    ipHint: rec.ip_hint,
  })

  const nextSid = newSession(rec.user_id, claims)

  const rotated = await store.rotateRefresh(rec.rid, nextRid)
  if (!rotated.ok) return { ok: false, error: 'rotation_failed' }

  await store.putSession(nextSid)

  return { ok: true, sid: nextSid.sid, rid: nextRid.rid, rememberMe: rec.remember_me }
}

/* ---------------------------------------------------------------------- */

export type LogoutInput = {
  sid?: string | null
  rid?: string | null
}

/* ---------------------------------------------------------------------- */

export async function logout(input: LogoutInput): Promise<{ ok: true }> {
  if (input.sid) {
    await store.deleteSession(input.sid)
  }
  if (input.rid) {
    const rec = await store.getRefresh(input.rid)
    if (rec) {
      await store.rotateRefresh(input.rid, {
        rid: `${input.rid}.revoked`,
        user_id: rec.user_id,
        remember_me: rec.remember_me,
        ua_hash: rec.ua_hash,
        ip_hint: rec.ip_hint,
        created_at: rec.created_at,
        last_used_at: Date.now(),
        absolute_exp_at: 0,
      })
    }
  }
  return { ok: true }
}
