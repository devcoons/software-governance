/* provider.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import 'server-only'
import { authenticator } from 'otplib'
import { findUserById, upsertTotpSecret, enableTotp, getTotpInfo } from '@/server/db/user-repo'
import { store } from '@/server/session/provider'
import { newSession } from '@/server/session/utils'
import { buildAuthCookies } from '@/server/http/cookie'
import config from '@/config'
import type { SessionRecord } from '@/server/session/store.i'

/* ---------------------------------------------------------------------- */

export type CookieSpec = ReturnType<typeof buildAuthCookies>[number]

/* ---------------------------------------------------------------------- */

export type TotpSetupResult = Readonly<{
  ok: true
  issuer: string
  account: string
  otpauthUrl: string
  cookies: CookieSpec[]
}>

/* ---------------------------------------------------------------------- */

export type TotpVerifyResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; error: 'totp_not_enabled' | 'no_secret' | 'invalid_code' }>

/* ---------------------------------------------------------------------- */

export  function buildKeyUri(input: { account: string; issuer: string; secret: string }): string {
  return authenticator.keyuri(input.account, input.issuer, input.secret)
}

/* ---------------------------------------------------------------------- */

function checkCode(secret: string, token: string): boolean {
  authenticator.options = { window: 1 }
  return authenticator.check(token, secret)
}

/* ---------------------------------------------------------------------- */

export async function setupTotp(
  accountId: string,
  issuer: string,
  opts?: { session?: SessionRecord }
): Promise<TotpSetupResult> {
  const user = await findUserById(accountId)
  const account = user?.email ?? user?.username ?? accountId

  const secret = authenticator.generateSecret()

  await upsertTotpSecret(accountId, secret)

  await enableTotp(accountId)

  const cookies: CookieSpec[] = []
  if (opts?.session && opts.session.user_id === accountId) {
    const updatedClaims = { ...opts.session.claims, totp_enabled: true }
    const next = newSession(accountId, updatedClaims)
    await store.deleteSession(opts.session.sid)
    await store.putSession(next)
    const sidOnly = buildAuthCookies({ sid: next.sid, rid: 'ignore', rememberMe: false })
      .filter(c => c.name === config.SESSION_COOKIE)
    cookies.push(...sidOnly)
  }

  const otpauthUrl = buildKeyUri({ account, issuer, secret })

  return { ok: true, issuer, account, otpauthUrl, cookies }
}

/* ---------------------------------------------------------------------- */

export async function verifyTotpPin(userId: string, pin: string): Promise<TotpVerifyResult> {

  const info = await getTotpInfo(userId)
  if (!info.enabled) return { ok: false, error: 'totp_not_enabled' }
  if (!info.secret) return { ok: false, error: 'no_secret' }

  const ok = checkCode(info.secret, String(pin ?? '').trim())
  if (!ok) return { ok: false, error: 'invalid_code' }

  return { ok: true }
}
