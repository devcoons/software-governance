/* server/auth/ctx.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import type { NextRequest, NextResponse } from 'next/server'
import { read as readSession } from './reader'
import { applyCookies, buildAuthCookies, buildClearAuthCookies, readRid } from '@/server/http/cookie'
import type { SessionRecord } from '@/server/session/store.i'

/* -----------------------------------
   Reuse existing server config & services
----------------------------------- */
import app from '@/config'                           /* cookie names, TTLs, etc. */
import { refresh, refresh as refreshSession } from '@/server/auth/service'
import { store } from '../session/provider'


/* ---------------------------------------------------------------------- */

export async function getSession(req?: NextRequest) {
  return readSession(req)
}

/* ---------------------------------------------------------------------- */

export function setAuthCookies(res: NextResponse, args: { sid: string; rid: string; rememberMe: boolean }) {
  applyCookies(res, buildAuthCookies(args))
}

/* ---------------------------------------------------------------------- */

export function clearAuth(res: NextResponse) {
  applyCookies(res, buildClearAuthCookies())
}

/* ---------------------------------------------------------------------- */

type MatchMode = 'any' | 'all'

type CheckOpts = {
  mode?: MatchMode
  caseSensitive?: boolean
}

/* ---------------------------------------------------------------------- */

function normalizeList(input: string[] | string, caseSensitive: boolean): string[] {
  const arr = Array.isArray(input) ? input : [input]
  return caseSensitive ? arr.map(String) : arr.map(s => String(s).toLowerCase())
}

/* ---------------------------------------------------------------------- */

function claimsList(sess: SessionRecord | null | undefined, key: 'roles' | 'permissions', caseSensitive: boolean): string[] {
  const raw = (sess?.claims as any)?.[key]
  if (!Array.isArray(raw)) return []
  return normalizeList(raw, caseSensitive)
}

/* ---------------------------------------------------------------------- */

function hasList(
  have: string[],
  want: string[] | string,
  opts?: CheckOpts
): boolean {
  const mode: MatchMode = opts?.mode ?? 'any'
  const caseSensitive = opts?.caseSensitive ?? false
  const wantNorm = normalizeList(want, caseSensitive)
  if (wantNorm.length === 0 || have.length === 0) return false
  const set = new Set(have)
  if (mode === 'all') {
    for (const w of wantNorm) if (!set.has(w)) return false
    return true
  }
  for (const w of wantNorm) if (set.has(w)) return true
  return false
}

/* ---------------------------------------------------------------------- */

export function hasRoles(
  sess: SessionRecord | null | undefined,
  roles: string[] | string,
  opts?: CheckOpts
): boolean {
  const caseSensitive = opts?.caseSensitive ?? false
  const have = claimsList(sess, 'roles', caseSensitive)
  return hasList(have, roles, opts)
}

/* ---------------------------------------------------------------------- */

export function hasPermissions(
  sess: SessionRecord | null | undefined,
  perms: string[] | string,
  opts?: CheckOpts
): boolean {
  const caseSensitive = opts?.caseSensitive ?? false
  const have = claimsList(sess, 'permissions', caseSensitive)
  return hasList(have, perms, opts)
}

/* ---------------------------------------------------------------------- */
/* NEW: getSessionAndRefresh
   - Try current SID via existing reader.
   - If absent/expired, use RID to call existing refresh().
   - Optionally set cookies on provided response (reusing setAuthCookies()).
   - Returns the SessionRecord (or null) plus a tiny bit of metadata.
   Reuses only existing modules. No new concepts.
*/
/* ---------------------------------------------------------------------- */

export type GetSessionAndRefreshResult = {
  session: SessionRecord | null
  refreshed: boolean
  error?: string
  /** Cookie descriptors to apply on your final response (only when refreshed) */
  cookies?: ReturnType<typeof buildAuthCookies>
}


export async function getSessionAndRefresh(req: NextRequest, res?: NextResponse): Promise<GetSessionAndRefreshResult> {
  const trace = req.headers.get('x-trace-id') ?? 'no-trace'
  const sidCookie = req.cookies.get(app.SESSION_COOKIE)?.value ?? ''
  const ridCookie = req.cookies.get(app.REFRESH_COOKIE)?.value ?? ''
  console.log('[API-AUTH]', trace, 'sid:', sidCookie ? '1' : '0', 'rid:', ridCookie ? '1' : '0')

  /* 1) Try current SID via existing reader */
  const current = await readSession(req)
  if (current) {
    console.log('[API-AUTH]', trace, 'session hit via SID')
    return { session: current, refreshed: false }
  }

  /* 2) No SID → try RID refresh */
  const rid = readRid(req)
  if (!rid) {
    console.log('[API-AUTH]', trace, 'no RID → unauthorized')
    return { session: null, refreshed: false, error: 'unauthorized' }
  }

  console.log('[API-AUTH]', trace, 'calling refresh with RID')
  const r = await refresh(req, rid)
  if (!r.ok) {
    console.log('[API-AUTH]', trace, 'refresh failed:', r.error)
    return { session: null, refreshed: false, error: r.error ?? 'refresh_failed' }
  }

  /* 3) Build cookies to attach to the REAL response the route will return */
  const cookies = buildAuthCookies({
    sid: r.sid!,
    rid: r.rid!,
    rememberMe: r.rememberMe === true,
  })

  // Optionally mutate an existing response if provided
  if (res) {
    applyCookies(res, cookies)
    res.headers.set('Cache-Control', 'no-store')
    res.headers.set('x-trace-id', trace)
  }

  /* 4) Load the new SID to return claims to the handler */
  const next = await store.getSession(r.sid!)
  if (!next) {
    console.log('[API-AUTH]', trace, 'session_put_failed after refresh')
    return { session: null, refreshed: true, error: 'session_put_failed' }
  }

  console.log('[API-AUTH]', trace, 'refresh OK; returning new session')
  return { session: next, refreshed: true, cookies }
}
