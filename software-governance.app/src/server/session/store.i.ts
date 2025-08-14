/* store.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import type { SessionClaims } from './claims'

/* ---------------------------------------------------------------------- */

export type SessionRecord = Readonly<{
  sid: string
  user_id: string
  claims: SessionClaims
  iat: number
  exp: number
}>

/* ---------------------------------------------------------------------- */

export type RefreshRecord = Readonly<{
  rid: string
  user_id: string
  remember_me: boolean
  ua_hash: string
  ip_hint: string
  created_at: number
  last_used_at: number
  absolute_exp_at: number
}>

/* ---------------------------------------------------------------------- */

export interface SessionStore {
  getSession(sid: string): Promise<SessionRecord | null>
  putSession(rec: SessionRecord): Promise<void>
  deleteSession(sid: string): Promise<void>
  listUserSessions(userId: string): Promise<SessionRecord[]>
  revokeUserSessions(userId: string, keepSid?: string): Promise<number>
  getRefresh(rid: string): Promise<RefreshRecord | null>
  putRefresh(rec: RefreshRecord): Promise<void>
  rotateRefresh(oldRid: string, next: RefreshRecord): Promise<{ ok: boolean }>
  revokeUserRefresh(userId: string): Promise<number>
}
