/* service.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import config from '@/config'
import { store } from '@/server/session/provider'
import { findUserByLogin, findUserById, burnTempPassword, updateLastLogin } from '@/server/db/user-repo'
import { verifyPassword, hashPassword } from '@/server/crypto/password'
import { claimsFromDbUser } from '@/server/session/claims'
import { newSession, newRefresh } from '@/server/session/utils'
import { getUaHash, getIpHint } from '@/server/auth/ua-ip'
import * as usersRepo from "@/server/db/user-repo";
import { verifyTotpPin } from "@/server/totp/provider";
import { getSession } from './ctx'


/* ---------------------------------------------------------------------- */

export type LoginInput = {
  login: string
  password: string
  rememberMe: boolean
}

type ServiceResult =
  | { ok: true }
  | { ok: false; error: "invalid_totp" | "weak_password" | "rate_limited" | "not_allowed" | "unknown" };

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

  await updateLastLogin(user.id)

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
    if (!rotated.ok) {
    const code = (rotated as any).code
    if (code === -2) {
      // RID reused → revoke all refresh + sessions for this user (family kill)
      await store.revokeUserRefresh(rec.user_id).catch(() => {})
      await store.revokeUserSessions(rec.user_id).catch(() => {})
      return { ok: false, error: 'reused' }          // bridge will clear cookies
    }
    if (code === -3) return { ok: false, error: 'ua_mismatch' }
    if (code === -4) return { ok: false, error: 'expired' }
    if (code === -1) return { ok: false, error: 'not_found' }
    return { ok: false, error: 'rotation_failed' }
  }

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


export async function resetPasswordWithTotp(
  username: string,
  newPassword: string,
  totp: string,
  ipHint?: string
): Promise<ServiceResult> {
  // Optional: simple rate limit (username + ip). Keep it conservative by default.

  // Policy check — use your central policy if you already have one.
  if (!isSanePassword(newPassword, config.PASSWORD_MIN_SIZE ?? 10)) {
    return { ok: false, error: "weak_password" };
  }

  const user = await usersRepo.findUserByLogin(username);
  if (!user) {
    // Avoid user enumeration: behave like success.
    return { ok: true };
  }

  // If account is disabled or TOTP not enabled, do not proceed (avoid telling the client why).
  if (user.is_active === false || user.totp_enabled === false) {
    return { ok: false, error: "not_allowed" };
  }

  const check = await verifyTotpPin(user.id, totp);
  if (!check.ok) {
    return { ok: false, error: "invalid_totp" };
  }

  // Hash and update password; clear any temp password flags if your repo supports it.
  const hash = await hashPassword(newPassword);
  await usersRepo.updateUserPassword(user.id, hash);

  // Revoke ALL sessions for this user (refresh + session ids), per spec.
  try {

    await store.revokeUserSessions(user.id);
  } catch {
    // If the store fails, the new password still applies, but it's safer to surface a generic error.
    // You may choose to log this and still return ok. Here we fail closed.
    return { ok: false, error: "unknown" };
  }

  // Optionally: write an audit event here (login not required).
  // await auditRepo.addEvent("password_reset_totp", user.id, { ip: ipHint });

  return { ok: true };
}

// ————— internals —————

function isSanePassword(pw: string, min = 10): boolean {
  if (pw.length < min) return false;
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/\d/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;
  return classes >= 2;
}
