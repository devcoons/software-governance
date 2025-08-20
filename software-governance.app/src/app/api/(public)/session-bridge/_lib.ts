/* ---------------------------------------------------------------------- */

import { NextRequest } from "next/server";

export type GuardState = { rid: string; ts: number; count: number }

/* ---------------------------------------------------------------------- */
export const BRIDGE_GUARD_COOKIE = '__bridge_guard'
const WINDOW_MS = 7_000   // N seconds window
const MAX_HITS  = 3        // "twice in N seconds" → block on the 2nd hit


export function parseGuard(raw?: string | null): GuardState | null {
  if (!raw) return null
  const [rid, tsStr, countStr] = raw.split('|')
  const ts = Number(tsStr), count = Number(countStr)
  if (!rid || !Number.isFinite(ts) || !Number.isFinite(count)) return null
  return { rid, ts, count }
}

export function encodeGuard(s: GuardState): string {
  return `${s.rid}|${s.ts}|${s.count}`
}

export function evalBridgeGuard(req: NextRequest) {
  const now = Date.now()
  const sid = req.cookies.get('sid')?.value ?? null
  const rid = req.cookies.get('rid')?.value ?? ''

  const cur = parseGuard(req.cookies.get(BRIDGE_GUARD_COOKIE)?.value)
  const within = (cur && (now - cur.ts) <= WINDOW_MS) || false
  const sameRid = !!cur && cur.rid === rid

  const nextCount = sameRid && within ? (cur!.count + 1) : 1
  const nextState: GuardState = { rid, ts: now, count: nextCount }

  // Block if: no SID yet, same RID repeating, within window, and this is the 2nd hit (or more)
  const shouldBlock = !sid && sameRid && within && nextCount >= MAX_HITS

  return { shouldBlock, nextState }
}