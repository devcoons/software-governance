/* store-redis.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import type { SessionStore, SessionRecord, RefreshRecord } from './store.i'
import config from '@/config'
import Redis from 'ioredis'

/* ---------------------------------------------------------------------- */

type Client = Redis

/* ---------------------------------------------------------------------- */

const g = globalThis as any
let client: Client | null = g.__SESSION_REDIS__ || null

/* ---------------------------------------------------------------------- */

function getClient(): Client {
  if (client) return client
  client = new Redis({
    host: config.REDIS_HOST,
    port: Number(config.REDIS_PORT),
    username: config.REDIS_USERNAME || undefined,
    password: config.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    connectTimeout: 3000,
    enableAutoPipelining: true,
  })
  const key = '__LISTENERS_ATTACHED__'
  if (!(client as any)[key]) {
    ;(client as any)[key] = true
    client.on('error', () => {})
    client.on('end', () => {})
  }
  g.__SESSION_REDIS__ = client
  return client
}

/* ---------------------------------------------------------------------- */

function sKey(sid: string) {
  return `${config.SESSION_PREFIX}${sid}`
}

function rKey(rid: string) {
  return `${config.REFRESH_PREFIX}${rid}`
}

function uSKey(userId: string) {
  return `${config.USER_SESSIONS_PREFIX}${userId}`
}

function uRKey(userId: string) {
  return `${config.USER_REFRESH_PREFIX}${userId}`
}

/* ---------------------------------------------------------------------- */

function safeParse<T>(s: string | null): T | null {
  if (!s) return null
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

/* ---------------------------------------------------------------------- */

export const redisStore: SessionStore = {
  async getSession(sid) {
    const c = getClient()
    try {
      if (c.status === 'wait' || c.status === 'end') await c.connect()
      const raw = await c.get(sKey(sid))
      const rec = safeParse<SessionRecord>(raw)
      return rec
    } catch {
      return null
    }
  },

  async putSession(rec) {
    const c = getClient()
    if (c.status === 'wait' || c.status === 'end') await c.connect()
    const ttlSec = Math.max(
      1,
      Math.floor((rec.exp - Date.now()) / 1000) || Number(config.SESSION_TTL_SECONDS)
    )
    await c.multi()
      .set(sKey(rec.sid), JSON.stringify(rec), 'EX', ttlSec)
      .sadd(uSKey(rec.user_id), rec.sid)
      .exec()
  },

  async deleteSession(sid) {
    const c = getClient()
    if (c.status === 'wait' || c.status === 'end') await c.connect()
    const raw = await c.get(sKey(sid))
    const rec = safeParse<SessionRecord>(raw)
    await c.multi()
      .del(sKey(sid))
      .srem(uSKey(rec?.user_id || ''), sid)
      .exec()
  },

  async listUserSessions(userId) {
    const c = getClient()
    if (c.status === 'wait' || c.status === 'end') await c.connect()
    const ids = await c.smembers(uSKey(userId))
    if (!ids.length) return []
    const keys = ids.map(sKey)
    const raws = await c.mget(keys)
    const out: SessionRecord[] = []
    for (const s of raws) {
      const rec = safeParse<SessionRecord>(s)
      if (rec) out.push(rec)
    }
    return out
  },

  async revokeUserSessions(userId, keepSid) {
    const c = getClient()
    if (c.status === 'wait' || c.status === 'end') await c.connect()
    const ids = await c.smembers(uSKey(userId))
    let count = 0
    const tx = c.multi()
    for (const sid of ids) {
      if (keepSid && sid === keepSid) continue
      tx.del(sKey(sid))
      tx.srem(uSKey(userId), sid)
      count++
    }
    await tx.exec()
    if (keepSid) {
      await c
        .multi()
        .del(uSKey(userId))
        .sadd(uSKey(userId), keepSid)
        .exec()
    } else {
      await c.del(uSKey(userId))
    }
    return count
  },

  async getRefresh(rid) {
    const c = getClient()
    try {
      if (c.status === 'wait' || c.status === 'end') await c.connect()
      const raw = await c.get(rKey(rid))
      return safeParse<RefreshRecord>(raw)
    } catch {
      return null
    }
  },

  async putRefresh(rec) {
    const c = getClient()
    if (c.status === 'wait' || c.status === 'end') await c.connect()
    const idleSec = Number(config.REFRESH_IDLE_TTL_SECONDS)
    await c.multi()
      .set(rKey(rec.rid), JSON.stringify(rec), 'EX', idleSec)
      .sadd(uRKey(rec.user_id), rec.rid)
      .exec()
  },

  async rotateRefresh(oldRid, next) {
    const c = getClient()
    if (c.status === 'wait' || c.status === 'end') await c.connect()
    const idleSec = Number(config.REFRESH_IDLE_TTL_SECONDS)
    const tx = c.multi()
      .del(rKey(oldRid))
      .set(rKey(next.rid), JSON.stringify(next), 'EX', idleSec)
      .srem(uRKey(next.user_id), oldRid)
      .sadd(uRKey(next.user_id), next.rid)
    try {
      await tx.exec()
      return { ok: true }
    } catch {
      return { ok: false }
    }
  },

  async revokeUserRefresh(userId) {
    const c = getClient()
    if (c.status === 'wait' || c.status === 'end') await c.connect()
    const ids = await c.smembers(uRKey(userId))
    const tx = c.multi()
    for (const rid of ids) {
      tx.del(rKey(rid))
    }
    tx.del(uRKey(userId))
    await tx.exec()
    return ids.length
  },
}
