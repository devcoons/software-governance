/* store-redis.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import type { SessionStore, SessionRecord, RefreshRecord } from './store.i'
import config from '@/config'
import Redis from 'ioredis'

/* ---------------------------------------------------------------------- */

type Client = Redis

/* ---------------------------------------------------------------------- */

type GlobalCache = {
  __SESSION_REDIS__?: Client | null;
  __SESSION_ROTATE_SHA__?: string | null;
  __SESSION_REDIS_LAST_ERR__?: string | null;
};

const g = globalThis as typeof globalThis & GlobalCache;

let client: Client | null = g.__SESSION_REDIS__ ?? null;

/* Cache for rotate script SHA (persist across HMR via global) */
let rotateSha: string | null = g.__SESSION_ROTATE_SHA__ ?? null;

/* Track last error for health reporting */
let lastRedisError: string | null = g.__SESSION_REDIS_LAST_ERR__ ?? null;

/* ---------------------------------------------------------------------- */
/* Key builders (match generated config) */

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
function uRZKey(userId: string) {
    return `${config.USER_REFRESH_ZSET_PREFIX}${userId}`
}

/* ---------------------------------------------------------------------- */

function getClient(): Client {
    if (client) return client
    client = new Redis({
        host: config.REDIS_HOST,
        port: Number(config.REDIS_PORT),
        username: config.REDIS_USERNAME ?? undefined,
        password: config.REDIS_PASSWORD ?? undefined,
        // If you terminate TLS at Redis, expose a REDIS_TLS=1 and set tls: {}
        // tls: config.REDIS_TLS ? {} as any : undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableAutoPipelining: true,
        connectionName: 'sgov-session',
    })
    client.on('error', (err) => {
        lastRedisError = String(err?.message ?? err ?? 'unknown')
        g.__SESSION_REDIS_LAST_ERR__ = lastRedisError
    })
    g.__SESSION_REDIS__ = client
    return client
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
/* Lua: atomic refresh rotation + per-user cap + replay signaling
   Returns array: { code, user_id, remember_me("0|1"), absolute_exp_at(ms) }
   Codes:
     1  = rotated OK
    -1  = not_found
    -2  = replay_old_token (old rid already poisoned)
    -3  = ua_mismatch
    -4  = absolute_expired
*/
const ROTATE_LUA = `
local oldKey       = KEYS[1]      -- rsh:<oldRid>
local newKey       = KEYS[2]      -- rsh:<newRid>
local userSetKey   = KEYS[3]      -- user:refresh:<userId>
local userZsetKey  = KEYS[4]      -- user:refreshz:<userId>
local maxKeyPrefix = KEYS[5]      -- rsh:  (for deletions when trimming zset)

local nowMs              = tonumber(ARGV[1])
local idleTtlSec         = tonumber(ARGV[2])
local bindUa             = tonumber(ARGV[3])      -- 0/1
local expectUaHash       = ARGV[4]                -- '' allowed
local newRid             = ARGV[5]
local newPoisonTtlSec    = tonumber(ARGV[6])      -- ttl for old rid tombstone (e.g., 900)
local maxRefreshPerUser  = tonumber(ARGV[7])

-- Load old record (hash)
if redis.call('EXISTS', oldKey) == 0 then
  return { -1 }
end

local fields = redis.call('HMGET', oldKey,
  'user_id','remember_me','ua_hash','ip_hint',
  'created_at','last_used_at','absolute_exp_at','poisoned')

local userId         = fields[1]
local remember_me    = fields[2] or '0'
local uaHashStored   = fields[3] or ''
local ipHint         = fields[4] or ''
local createdAt      = tonumber(fields[5]) or 0
local lastUsedAt     = tonumber(fields[6]) or 0
local absoluteExpAt  = tonumber(fields[7]) or 0
local poisoned       = tonumber(fields[8]) or 0

if poisoned == 1 then
  return { -2, userId }
end

if bindUa == 1 and expectUaHash ~= '' and uaHashStored ~= '' and uaHashStored ~= expectUaHash then
  return { -3, userId }
end

if absoluteExpAt > 0 and nowMs >= absoluteExpAt then
  return { -4, userId }
end

-- TTL for new rid: min(idle, remaining absolute)
local remainingAbsSec = 0
if absoluteExpAt > 0 then
  remainingAbsSec = math.floor((absoluteExpAt - nowMs) / 1000)
  if remainingAbsSec < 0 then remainingAbsSec = 0 end
end
local ttlSec = idleTtlSec
if remainingAbsSec > 0 and remainingAbsSec < ttlSec then
  ttlSec = remainingAbsSec
end
if ttlSec <= 0 then
  return { -4, userId }
end

-- Create new rid hash; copy key fields, update times
redis.call('HMSET', newKey,
  'user_id',        userId,
  'remember_me',    remember_me,
  'ua_hash',        uaHashStored,
  'ip_hint',        ipHint,
  'created_at',     nowMs,
  'last_used_at',   nowMs,
  'absolute_exp_at',absoluteExpAt,
  'parent',         string.sub(oldKey, string.len('${config.REFRESH_PREFIX}') + 1)
)
redis.call('EXPIRE', newKey, ttlSec)

-- Poison old rid; short tombstone TTL for replay detection
redis.call('HSET', oldKey, 'poisoned', 1)
redis.call('HSET', oldKey, 'rotated_to', string.sub(newKey, string.len('${config.REFRESH_PREFIX}') + 1))
redis.call('EXPIRE', oldKey, newPoisonTtlSec)

-- Move membership
redis.call('SREM', userSetKey, string.sub(oldKey, string.len('${config.REFRESH_PREFIX}') + 1))
redis.call('SADD', userSetKey, string.sub(newKey, string.len('${config.REFRESH_PREFIX}') + 1))

-- ZSET LRU: add new, remove old
redis.call('ZREM', userZsetKey, string.sub(oldKey, string.len('${config.REFRESH_PREFIX}') + 1))
redis.call('ZADD', userZsetKey, nowMs, string.sub(newKey, string.len('${config.REFRESH_PREFIX}') + 1))

-- Trim to maxRefreshPerUser
if maxRefreshPerUser > 0 then
  local count = redis.call('ZCARD', userZsetKey)
  if count > maxRefreshPerUser then
    local toTrim = count - maxRefreshPerUser
    local victims = redis.call('ZRANGE', userZsetKey, 0, toTrim - 1)
    for _, rid in ipairs(victims) do
      redis.call('ZREM', userZsetKey, rid)
      redis.call('SREM', userSetKey, rid)
      redis.call('DEL', maxKeyPrefix .. rid)
    end
  end
end

return { 1, userId, remember_me, absoluteExpAt }
`

/* ---------------------------------------------------------------------- */

async function ensureRotateSha(c: Client): Promise<string> {
  if (rotateSha) return rotateSha;
  if (c.status === "wait" || c.status === "end") await c.connect();
  const sha = await (c as Client & {
    script(command: "load", script: string): Promise<string>;
  }).script("load", ROTATE_LUA);
  rotateSha = sha;
  g.__SESSION_ROTATE_SHA__ = sha;
  return sha;
}

/* ---------------------------------------------------------------------- */

export const redisStore: SessionStore = {
    /* ------------------------ Sessions -------------------------------- */

    async getSession(sid) {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        const raw = await c.get(sKey(sid))
        return safeParse<SessionRecord>(raw)
    },

    async putSession(rec) {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        const ttlSec = Math.max(1, Math.floor((rec.exp - Date.now()) / 1000))
        const tx = c.multi()
        tx.set(sKey(rec.sid), JSON.stringify(rec), 'EX', ttlSec)
        tx.sadd(uSKey(rec.user_id), rec.sid)
        // Keep the index around roughly as long as refreshes live
        tx.expire(uSKey(rec.user_id), Number(config.REFRESH_IDLE_TTL_SECONDS))
        await tx.exec()
    },

    async deleteSession(sid) {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        // Try to discover user id from the record (best effort)
        const raw = await c.get(sKey(sid))
        const rec = safeParse<SessionRecord>(raw)
        const tx = c.multi()
        tx.del(sKey(sid))
        if (rec) tx.srem(uSKey(rec.user_id), sid)
        await tx.exec()
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
            const v = safeParse<SessionRecord>(s)
            if (v) out.push(v)
        }
        return out
    },

    async revokeUserSessions(userId, keepSid) {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        const ids = await c.smembers(uSKey(userId))
        const tx = c.multi()
        let count = 0
        for (const sid of ids) {
            if (keepSid && sid === keepSid) continue
            tx.del(sKey(sid))
            tx.srem(uSKey(userId), sid)
            count++
        }
        await tx.exec()
        return count
    },

    /* ------------------------ Refresh --------------------------------- */

    async getRefresh(rid) {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        const vals = await c.hgetall(rKey(rid))
        if (!vals || Object.keys(vals).length === 0) return null
        const toBool = (x?: string) => x === '1' || x === 'true'
        const toNum = (x?: string) => (x ? Number(x) : 0)
        const rec: RefreshRecord = {
            rid,
            user_id: vals.user_id,
            remember_me: toBool(vals.remember_me),
            ua_hash: vals.ua_hash ?? '',
            ip_hint: vals.ip_hint ?? '',
            created_at: toNum(vals.created_at),
            last_used_at: toNum(vals.last_used_at),
            absolute_exp_at: toNum(vals.absolute_exp_at),
        }
        return rec
    },

    async putRefresh(rec) {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        const ttlAbsSec = Math.max(1, Math.floor((rec.absolute_exp_at - Date.now()) / 1000))
        const idleSec = Number(config.REFRESH_IDLE_TTL_SECONDS)
        const ttlSec = Math.max(1, Math.min(ttlAbsSec, idleSec))
        const h: Record<string, string | number> = {
            user_id: rec.user_id,
            remember_me: rec.remember_me ? 1 : 0,
            ua_hash: rec.ua_hash ?? '',
            ip_hint: rec.ip_hint ?? '',
            created_at: rec.created_at,
            last_used_at: rec.last_used_at,
            absolute_exp_at: rec.absolute_exp_at,
            poisoned: 0,
        }
        const tx = c.multi()
        tx.hmset(rKey(rec.rid), h)
        tx.expire(rKey(rec.rid), ttlSec)
        tx.sadd(uRKey(rec.user_id), rec.rid)
        tx.zadd(uRZKey(rec.user_id), Date.now(), rec.rid)
        tx.expire(uRKey(rec.user_id), Number(config.REFRESH_IDLE_TTL_SECONDS))
        tx.expire(uRZKey(rec.user_id), Number(config.REFRESH_IDLE_TTL_SECONDS))
        await tx.exec()
    },

    async rotateRefresh(oldRid, next) {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        const sha = await ensureRotateSha(c)
        const now = Date.now()
        const keys = [
            rKey(oldRid),
            rKey(next.rid),
            uRKey(next.user_id),
            uRZKey(next.user_id),
            config.REFRESH_PREFIX, // for DEL during trimming
        ]
        const args = [
            String(now),
            String(Number(config.REFRESH_IDLE_TTL_SECONDS)),
            config.BIND_UA ? '1' : '0',
            next.ua_hash ?? '',
            next.rid,
            String(900), // poison tombstone TTL in seconds (15 min)
            String(Number(config.MAX_REFRESH_PER_USER) || 0),
        ]
        let result: any
        try {
            result = await (c as any).evalsha(sha, keys.length, ...keys, ...args)
        } catch (e: any) {
            // In case of a cache miss after Redis restart, load again and retry once
            if (String(e?.message ?? e).includes('NOSCRIPT')) {
                rotateSha = null
                const freshSha = await ensureRotateSha(c)
                result = await (c as any).evalsha(freshSha, keys.length, ...keys, ...args)
            } else {
                throw e
            }
        }

        const code = Number(result?.[1] ? result[1] : result?.[0])
        // normalize outputs
        const rc = Number(result?.[0])
        if (rc === 1) {
            // OK
            return { ok: true }
        }
        // map to service-level errors via codes (service should act accordingly)
        // -2 => replay_old_token; -4 => absolute_expired; -3 => ua_mismatch; -1 => not_found
        return { ok: false, code: rc }
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
        tx.del(uRZKey(userId))
        await tx.exec()
        return ids.length
    },
}

/* ---------------------------------------------------------------------- */
/* helpers for health reporting (optional export if you wire health JSON) */

export function getLastRedisError(): string | null {
    return lastRedisError
}

/* ---------------------------------------------------------------------- */
