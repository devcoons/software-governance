/* server/auth/ctx.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import type { NextRequest, NextResponse } from 'next/server'
import { read as readSession } from './reader'
import { applyCookies, buildAuthCookies, buildClearAuthCookies } from '@/server/http/cookie'
import type { SessionRecord } from '@/server/session/store.i'

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