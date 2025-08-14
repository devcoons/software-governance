/* utils.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import config from '@/config'
import type { SessionClaims } from './claims'
import type { SessionRecord, RefreshRecord } from './store.i'
import { randomId } from '@/server/crypto/random-id'

/* ---------------------------------------------------------------------- */

export function newSession(userId: string, claims: SessionClaims): SessionRecord {
  const now = Date.now()
  const iat = now
  const exp = now + Number(config.SESSION_TTL_SECONDS) * 1000
  return {
    sid: randomId(32),
    user_id: userId,
    claims,
    iat,
    exp,
  }
}

/* ---------------------------------------------------------------------- */

export function newRefresh(input: {
  userId: string
  rememberMe: boolean
  uaHash: string
  ipHint: string
}): RefreshRecord {
  const now = Date.now()
  const absMs = Number(config.REFRESH_ABSOLUTE_TTL_SECONDS) * 1000
  return {
    rid: randomId(32),
    user_id: input.userId,
    remember_me: input.rememberMe,
    ua_hash: input.uaHash,
    ip_hint: input.ipHint,
    created_at: now,
    last_used_at: now,
    absolute_exp_at: now + absMs,
  }
}
