
/* eslint-disable @typescript-eslint/no-empty-object-type */
interface AppSessionClaims {}   // ← canonical, single definition

/* ---------------------------------------------------------------------- */

export type SessionClaims = AppSessionClaims
export type SessionClaimsParser<T> = { parse(input: unknown): T }



/* ---------------------------------------------------------------------- */

export type SessionRecord = Readonly<{
    sid         : string
    user_id     : string
    iat         : number
    exp         : number
    parent_rid? : string
    claims      : SessionClaims
}>

/* ---------------------------------------------------------------------- */

export type RefreshRecord = Readonly<{
    rid             : string
    user_id         : string
    remember_me     : boolean
    ua_hash         : string
    ip_hint         : string
    created_at      : number
    last_used_at    : number
    absolute_exp_at : number
}>

/* ---------------------------------------------------------------------- */

export type GetAndRefreshSessionResult =
  | { ok: true; sid: string; rid: string; }
  | { ok: false; error: string }

/* ---------------------------------------------------------------------- */

export type LogoutMode = 'device' | 'all'

/* ---------------------------------------------------------------------- */

export type LogoutResult =
  | { ok: true; mode: LogoutMode; revoked: { sid?: string | null; rid?: string | null; sessionsRemoved?: number; refreshRemoved?: number } }
  | { ok: false; error: 'unauthorized:nosession' | 'user_not_found' | 'internal' }

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */