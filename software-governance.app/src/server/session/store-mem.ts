/* store-memory.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import type { SessionStore, SessionRecord, RefreshRecord } from './store.i'

/* ---------------------------------------------------------------------- */

const sessions = new Map<string, SessionRecord>()
const refreshes = new Map<string, RefreshRecord>()
const userSids = new Map<string, Set<string>>()
const userRids = new Map<string, Set<string>>()

/* ---------------------------------------------------------------------- */

function addIndex(map: Map<string, Set<string>>, key: string, id: string) {
  let set = map.get(key)
  if (!set) {
    set = new Set()
    map.set(key, set)
  }
  set.add(id)
}

/* ---------------------------------------------------------------------- */

function delIndex(map: Map<string, Set<string>>, key: string, id: string) {
  const set = map.get(key)
  if (set) {
    set.delete(id)
    if (set.size === 0) map.delete(key)
  }
}

/* ---------------------------------------------------------------------- */

export const memoryStore: SessionStore = {
  async getSession(sid) {
    const rec = sessions.get(sid) || null
    if (!rec) return null
    if (rec.exp <= Date.now()) {
      await this.deleteSession(sid)
      return null
    }
    return rec
  },

  async putSession(rec) {
    sessions.set(rec.sid, rec)
    addIndex(userSids, rec.user_id, rec.sid)
  },

  async deleteSession(sid) {
    const rec = sessions.get(sid)
    if (rec) delIndex(userSids, rec.user_id, sid)
    sessions.delete(sid)
  },

  async listUserSessions(userId) {
    const ids = Array.from(userSids.get(userId) || [])
    const now = Date.now()
    return ids
      .map(id => sessions.get(id))
      .filter((r): r is SessionRecord => Boolean(r && r.exp > now))
  },

  async revokeUserSessions(userId, keepSid) {
    const ids = Array.from(userSids.get(userId) || [])
    let count = 0
    for (const sid of ids) {
      if (keepSid && sid === keepSid) continue
      await this.deleteSession(sid)
      count++
    }
    return count
  },

  async getRefresh(rid) {
    const rec = refreshes.get(rid) || null
    if (!rec) return null
    if (rec.absolute_exp_at <= Date.now()) {
      refreshes.delete(rid)
      delIndex(userRids, rec.user_id, rid)
      return null
    }
    return rec
  },

  async putRefresh(rec) {
    refreshes.set(rec.rid, rec)
    addIndex(userRids, rec.user_id, rec.rid)
  },

  async rotateRefresh(oldRid, next) {
    const old = refreshes.get(oldRid)
    if (!old) return { ok: false }
    refreshes.delete(oldRid)
    delIndex(userRids, old.user_id, oldRid)
    await this.putRefresh(next)
    return { ok: true }
  },

  async revokeUserRefresh(userId) {
    const ids = Array.from(userRids.get(userId) || [])
    let count = 0
    for (const rid of ids) {
      if (refreshes.delete(rid)) count++
    }
    userRids.delete(userId)
    return count
  },
}
