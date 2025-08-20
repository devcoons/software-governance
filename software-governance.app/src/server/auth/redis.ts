/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/auth/redis.ts */
/* ---------------------------------------------------------------------- */

import config from '@/config'
import Redis from 'ioredis'
import { RefreshRecord, SessionRecord } from './types'

/* ---------------------------------------------------------------------- */

type Client = Redis

/* ---------------------------------------------------------------------- */

type GlobalCache = {
    __SESSION_REDIS__?: Client | null
    __SESSION_ROTATE_SHA__?: string | null
    __SESSION_REDIS_LAST_ERR__?: string | null
}

const g = globalThis as typeof globalThis & GlobalCache

let client: Client | null = g.__SESSION_REDIS__ ?? null
let rotateSha: string | null = g.__SESSION_ROTATE_SHA__ ?? null
let lastRedisError: string | null = g.__SESSION_REDIS_LAST_ERR__ ?? null

/* Tunables */
const REFRESH_REPLAY_GRACE_MS = 2000
const REFRESH_TOMBSTONE_TTL_SEC = 7000
const STALE_ROTATE_MS = 5000

/* ---------------------------------------------------------------------- */
/* Key builders (must match generated config) */

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

/* Optional: one SID per RID mapping */
function rid2sidKey(rid: string) {
    return `${config.REFRESH_PREFIX}rid2sid:${rid}`
}

/* ---------------------------------------------------------------------- */

function getClient(): Client {
    if (client) return client
    console.log('[REDIS] Creating ioredis client…', {
        host: config.REDIS_HOST,
        port: Number(config.REDIS_PORT),
        username: !!config.REDIS_USERNAME,
    })
    client = new Redis({
        host: config.REDIS_HOST,
        port: Number(config.REDIS_PORT),
        username: config.REDIS_USERNAME || undefined,
        password: config.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableAutoPipelining: true,
        connectionName: 'sgov-session',
    })
    client.on('error', (err) => {
        lastRedisError = String(err?.message ?? err ?? 'unknown')
        g.__SESSION_REDIS_LAST_ERR__ = lastRedisError
        console.error('[REDIS] Client error:', lastRedisError)
    })
    g.__SESSION_REDIS__ = client
    return client
}

/* ---------------------------------------------------------------------- */

function safeParse<T>(s: string | null): T | null {
    if (!s) return null
    try {
        return JSON.parse(s) as T
    } catch (e) {
        console.warn('[PARSE] Failed to parse JSON value from Redis:', e)
        return null
    }
}

/* ---------------------------------------------------------------------- */
/* Lua: atomic refresh rotation v4 (Redis TIME, stale-lock recovery, grace) */

const ROTATE_LUA = `
local oldKey       = KEYS[1]
local newKey       = KEYS[2]
local userSetKey   = KEYS[3]
local userZsetKey  = KEYS[4]
local maxKeyPrefix = KEYS[5]

local idleTtlSec         = tonumber(ARGV[1])
local bindUa             = tonumber(ARGV[2])
local expectUaHash       = ARGV[3]
local newRid             = ARGV[4]
local tombstoneTtlSec    = tonumber(ARGV[5])
local maxRefreshPerUser  = tonumber(ARGV[6])
local bindIp             = tonumber(ARGV[7])
local expectIpHint       = ARGV[8]
local graceMs            = tonumber(ARGV[9])
local staleRotateMs      = tonumber(ARGV[10])

local t = redis.call('TIME')
local nowMs = (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)

if redis.call('EXISTS', oldKey) == 0 then
  return { -1 }
end

local fields = redis.call('HMGET', oldKey,
  'user_id','remember_me','ua_hash','ip_hint',
  'absolute_exp_at','poisoned','rotated_to','rotated_at','rotating'
)

local userId        = fields[1]
local remember_me   = fields[2] or '0'
local uaHashStored  = fields[3] or ''
local ipHintStored  = fields[4] or ''
local absoluteExpAt = tonumber(fields[5]) or 0
local poisoned      = tonumber(fields[6]) or 0
local rotatedTo     = fields[7] or ''
local rotatedAt     = tonumber(fields[8]) or 0
local rotatingAt    = tonumber(fields[9]) or 0

local function ua_ok()
  return (bindUa == 0) or (expectUaHash == '' or uaHashStored == '' or uaHashStored == expectUaHash)
end
local function ip_ok()
  return (bindIp == 0) or (expectIpHint == '' or ipHintStored == '' or ipHintStored == expectIpHint)
end
local function within_grace(ts)
  return (graceMs > 0 and ts > 0 and (nowMs - ts) <= graceMs)
end

if poisoned == 1 then
  if rotatedTo ~= '' and within_grace(rotatedAt) and ua_ok() and ip_ok() then
    return { 2, userId, remember_me, absoluteExpAt, rotatedTo }
  end
  return { -2, userId }
end

if rotatingAt > 0 then
  if rotatedTo ~= '' and within_grace(rotatedAt) and ua_ok() and ip_ok() then
    return { 2, userId, remember_me, absoluteExpAt, rotatedTo }
  end
  if staleRotateMs > 0 and (nowMs - rotatingAt) > staleRotateMs then
    -- stale lock; continue
  else
    return { 0 }
  end
end

local acquired = redis.call('HSETNX', oldKey, 'rotating', nowMs)
if acquired == 0 then
  return { 0 }
end

if not ua_ok() then return { -3, userId } end
if not ip_ok() then return { -5, userId } end
if absoluteExpAt > 0 and nowMs >= absoluteExpAt then return { -4, userId } end

if redis.call('EXISTS', newKey) == 1 then
  rotatedTo = string.sub(newKey, string.len('${config.REFRESH_PREFIX}') + 1)
  redis.call('HMSET', oldKey, 'poisoned', 1, 'rotated_to', rotatedTo, 'rotated_at', nowMs)
  redis.call('EXPIRE', oldKey, tombstoneTtlSec)
  redis.call('SREM', userSetKey, string.sub(oldKey, string.len('${config.REFRESH_PREFIX}') + 1))
  redis.call('SADD', userSetKey, rotatedTo)
  redis.call('ZREM', userZsetKey, string.sub(oldKey, string.len('${config.REFRESH_PREFIX}') + 1))
  redis.call('ZADD', userZsetKey, nowMs, rotatedTo)
  return { 2, userId, remember_me, absoluteExpAt, rotatedTo }
end

local remainingAbsSec = 0
if absoluteExpAt > 0 then
  remainingAbsSec = math.floor((absoluteExpAt - nowMs) / 1000)
  if remainingAbsSec < 0 then remainingAbsSec = 0 end
end
local ttlSec = idleTtlSec
if remainingAbsSec > 0 and remainingAbsSec < ttlSec then ttlSec = remainingAbsSec end
if ttlSec <= 0 then return { -4, userId } end

redis.call('HMSET', newKey,
  'user_id',        userId,
  'remember_me',    remember_me,
  'ua_hash',        uaHashStored,
  'ip_hint',        ipHintStored,
  'created_at',     nowMs,
  'last_used_at',   nowMs,
  'absolute_exp_at',absoluteExpAt,
  'parent',         string.sub(oldKey, string.len('${config.REFRESH_PREFIX}') + 1),
  'poisoned',       0
)
redis.call('EXPIRE', newKey, ttlSec)

local newRidShort = string.sub(newKey, string.len('${config.REFRESH_PREFIX}') + 1)
redis.call('HMSET', oldKey, 'poisoned', 1, 'rotated_to', newRidShort, 'rotated_at', nowMs)
redis.call('EXPIRE', oldKey, tombstoneTtlSec)

redis.call('SREM', userSetKey, string.sub(oldKey, string.len('${config.REFRESH_PREFIX}') + 1))
redis.call('SADD', userSetKey, newRidShort)
redis.call('ZREM', userZsetKey, string.sub(oldKey, string.len('${config.REFRESH_PREFIX}') + 1))
redis.call('ZADD', userZsetKey, nowMs, newRidShort)

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

return { 1, userId, remember_me, absoluteExpAt, newRidShort }
`

/* ---------------------------------------------------------------------- */

async function ensureRotateSha(c: Client): Promise<string> {
    if (rotateSha) return rotateSha
    if (c.status === 'wait' || c.status === 'end') await c.connect()
    console.log('[ROTATE] Loading Lua script…')
    const sha = await (c as Client & { script(command: 'load', script: string): Promise<string> }).script('load', ROTATE_LUA)
    rotateSha = sha
    g.__SESSION_ROTATE_SHA__ = sha
    console.log('[ROTATE] Lua loaded, sha:', sha)
    return sha
}

/* ---------------------------------------------------------------------- */

export const redisStore = {

    /* ---------------------------------------------------------------------- */

    async getSession(sid: string): Promise<SessionRecord | null> {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        console.log('[SESS:get] sid=', sid)
        const raw = await c.get(sKey(sid))
        
        if(!raw)
            return null
        
        const parsed = safeParse<SessionRecord>(raw)
        if(!parsed)
            return null

        console.log('[SESS:get] found=', !!parsed)
        return parsed
    },

    /* ---------------------------------------------------------------------- */

    async putSession(rec: SessionRecord):Promise<void> {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        const ttlSec = Math.max(1, Math.floor((rec.exp - Date.now()) / 1000))
        console.log('[SESS:put] sid=', rec.sid, 'uid=', rec.user_id, 'ttlSec=', ttlSec, 'parent_rid=', (rec as { parent_rid?: string }).parent_rid ?? null)

        const tx = c.multi()
        tx.set(sKey(rec.sid), JSON.stringify(rec), 'EX', ttlSec)
        tx.sadd(uSKey(rec.user_id), rec.sid)
        tx.expire(uSKey(rec.user_id), Number(config.REFRESH_IDLE_TTL_SECONDS))

        const parentRid = rec.parent_rid
        if (parentRid && parentRid.length > 0) {
            const mapKey = rid2sidKey(parentRid)
            console.log('[SESS:put] updating rid→sid mapping:', parentRid, '→', rec.sid)
            tx.get(mapKey)

            type TxReply = Array<[Error | null, unknown]>
            const repliesNullable = (await tx.exec()) as TxReply | null

            let prevSid: string | null = null
            if (repliesNullable && repliesNullable.length > 0) {
                const getIdx = repliesNullable.length - 1
                const pair = repliesNullable[getIdx]
                const val = pair?.[1]
                if (typeof val === 'string') prevSid = val
            }

            // Follow-up tx to repair the rid→sid map and clean old SID if needed
            const tx2 = c.multi()
            tx2.set(mapKey, rec.sid)
            if (prevSid && prevSid !== rec.sid) {
                console.log('[SESS:put] replacing old SID for RID:', parentRid, 'oldSid=', prevSid)
                tx2.del(sKey(prevSid))
                tx2.srem(uSKey(rec.user_id), prevSid)
            }
            await tx2.exec()
            console.log('[SESS:put] done')
            return
        } else {
            await tx.exec()
            console.log('[SESS:put] done')
        }
    },

    /* ---------------------------------------------------------------------- */

    async deleteSession(sid: string): Promise<void>{
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        console.log('[SESS:del] sid=', sid)
        const raw = await c.get(sKey(sid))
        const rec = safeParse<SessionRecord>(raw)
        const tx = c.multi()
        tx.del(sKey(sid))
        if (rec) tx.srem(uSKey(rec.user_id), sid)
        await tx.exec()
        console.log('[SESS:del] removed. hadRec=', !!rec)
    },

    /* ---------------------------------------------------------------------- */

    async listUserSessions(userId: string) : Promise<SessionRecord[]>{
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        console.log('[SESS:list] uid=', userId)
        const ids = await c.smembers(uSKey(userId))
        if (!ids.length) {
            console.log('[SESS:list] none')
            return []
        }
        const keys = ids.map(sKey)
        const raws = await c.mget(keys)
        const out: SessionRecord[] = []
        for (const s of raws) {
            const v = safeParse<SessionRecord>(s)
            if (v) out.push(v)
        }
        console.log('[SESS:list] count=', out.length)
        return out
    },

    /* ---------------------------------------------------------------------- */

    async revokeUserSessions(userId: string, keepSid? : string): Promise<number> {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        console.log('[SESS:revokeAll] uid=', userId, 'keepSid=', keepSid || null)
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
        console.log('[SESS:revokeAll] removed=', count)
        return count
    },

    /* ------------------------ Refresh --------------------------------- */

    async getRefresh(rid : string): Promise<RefreshRecord | null> {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        console.log('[RF:get] rid=', rid)
        const vals = await c.hgetall(rKey(rid))
        if (!vals || Object.keys(vals).length === 0) {
            console.log('[RF:get] not found')
            return null
        }
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
        console.log('[RF:get] ok user_id=', rec.user_id, 'created_at=', rec.created_at, 'abs_at=', rec.absolute_exp_at)
        return rec
    },

    /* ---------------------------------------------------------------------- */

    async putRefresh(rec: RefreshRecord) : Promise<void>{
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
        console.log('[RF:put] rid=', rec.rid, 'uid=', rec.user_id, 'ttlSec=', ttlSec)
        const tx = c.multi()
        tx.hmset(rKey(rec.rid), h)
        tx.expire(rKey(rec.rid), ttlSec)
        tx.sadd(uRKey(rec.user_id), rec.rid)
        tx.zadd(uRZKey(rec.user_id), Date.now(), rec.rid)
        tx.expire(uRKey(rec.user_id), Number(config.REFRESH_IDLE_TTL_SECONDS))
        tx.expire(uRZKey(rec.user_id), Number(config.REFRESH_IDLE_TTL_SECONDS))
        await tx.exec()
        console.log('[RF:put] done')
    },

    /* ---------------------------------------------------------------------- */

    async rotateRefresh(oldRid: string, next: RefreshRecord): Promise<{ ok: boolean, rid?: string; code?: number; userId?: string; remember?: boolean; absExpAt?: number }> {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') 
            await c.connect()

        const sha = await ensureRotateSha(c)

        const keys = [
            rKey(oldRid),
            rKey(next.rid),
            uRKey(next.user_id),
            uRZKey(next.user_id),
            config.REFRESH_PREFIX,
        ]
        const args = [
            String(Number(config.REFRESH_IDLE_TTL_SECONDS)),
            config.BIND_UA ? '1' : '0',
            next.ua_hash ?? '',
            next.rid,
            String(REFRESH_TOMBSTONE_TTL_SEC),
            String(Number(config.MAX_REFRESH_PER_USER) || 0),
            config.BIND_IP ? '1' : '0',
            next.ip_hint ?? '',
            String(REFRESH_REPLAY_GRACE_MS),
            String(STALE_ROTATE_MS),
        ]

        console.log('[RF:rotate] ENTER oldRid=', oldRid, '→ newRid=', next.rid, 'uid=', next.user_id)
        console.log('[RF:rotate] KEYS=', keys)
        console.log('[RF:rotate] ARGS=', args)

        const run = async (): Promise<{ ok: boolean; rid?: string; code?: number; userId?: string; remember?: boolean; absExpAt?: number }> => {
            type LuaResult = unknown
            let result: LuaResult
            try {
            // ioredis exposes evalsha on the client; no `any` needed
            result = await c.evalsha(sha, keys.length, ...keys, ...args)
            } catch (e: unknown) {
            const msg = String((e as { message?: unknown })?.message ?? e)
            console.warn('[RF:rotate] evalsha error:', msg)
            if (msg.includes('NOSCRIPT')) {
                rotateSha = null
                const freshSha = await ensureRotateSha(c)
                result = await c.evalsha(freshSha, keys.length, ...keys, ...args)
            } else {
                throw e
            }
            }

            console.log('[RF:rotate] LUA result=', result)
            const arr = Array.isArray(result) ? result : []
            const code = Number(arr[0])
            const userId = typeof arr[1] === 'string' ? arr[1] : undefined
            const remember = String(arr[2] ?? '0') === '1'
            const absExpAt = typeof arr[3] === 'number' ? arr[3] : Number(arr[3] ?? 0) || 0
            const ridOut = typeof arr[4] === 'string' ? arr[4] : undefined

            if (code === 1 || code === 2) {
                console.log('[RF:rotate] SUCCESS code=', code, 'effectiveRid=', ridOut)
                return { ok: true, rid: ridOut!,userId:  userId,remember: remember,absExpAt: absExpAt,code: code}
            }
            console.log('[RF:rotate] NON-SUCCESS code=', code)
            return { ok: false, code:code }
        }

        let rc = await run()
        if (!rc.ok && rc.code === 0) {
            console.log('[RF:rotate] BUSY → short retry…')
            await new Promise((r) => setTimeout(r, 75))
            rc = await run()
            if (!rc.ok && rc.code === 0) {
                console.log('[RF:rotate] Still BUSY after retry → attempting salvage read of rotated_to…')
                const ridMaybe = await getRotatedToFromOldRaw(next.user_id, oldRid)
                if (ridMaybe) {
                    console.log('[RF:rotate] Salvaged rotated_to=', ridMaybe, '→ treat as success')
                    return { ok: true, rid: ridMaybe, code:3 }
                }
            }
        }

        return rc
    },

    /* ---------------------------------------------------------------------- */

    async revokeUserRefresh(userId: string): Promise<number> {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()
        console.log('[RF:revokeAll] uid=', userId)
        const ids = await c.smembers(uRKey(userId))
        const tx = c.multi()
        for (const rid of ids) tx.del(rKey(rid))
        tx.del(uRKey(userId))
        tx.del(uRZKey(userId))
        await tx.exec()
        console.log('[RF:revokeAll] removed=', ids.length)
        return ids.length
    },

    /* ---------------------------------------------------------------------- */

    async getSidByRid(rid: string): Promise<string | null> {
        return getSidByRidInternal(rid)
    },

    /* ---------------------------------------------------------------------- */

    async deleteRefresh(rid: string): Promise<boolean> {
        const c = getClient()
        if (c.status === 'wait' || c.status === 'end') await c.connect()

        // Need user_id to clean up the user's sets
        const vals = await c.hgetall(rKey(rid))
        if (!vals || Object.keys(vals).length === 0) {
            console.log('[RF:del] not found rid=', rid)
            return false
        }
        const userId = vals.user_id

        console.log('[RF:del] rid=', rid, 'uid=', userId)
        const tx = c.multi()
        tx.del(rKey(rid))
        if (userId) {
            tx.srem(uRKey(userId), rid)
            tx.zrem(uRZKey(userId), rid)
        }
        await tx.exec()
        return true
    },

}

/* ---------------------------------------------------------------------- */

export function getLastRedisError(): string | null {
    return lastRedisError
}

/* ---------------------------------------------------------------------- */

async function getSidByRidInternal(rid: string): Promise<string | null> {
    const c = getClient()
    if (c.status === 'wait' || c.status === 'end') await c.connect()

    const mapKey = rid2sidKey(rid)
    console.log('[MAP:getSidByRid] rid=', rid)

    const [mappedSidRaw, refreshVals] = await Promise.all([
        c.get(mapKey) as Promise<string | null>,
        c.hgetall(rKey(rid)) as Promise<Record<string, string>>, // {} when missing
    ])

    const mappedSid: string | null = mappedSidRaw
    const userId = refreshVals.user_id

    if (mappedSid) {
        const raw = await c.get(sKey(mappedSid))
        if (raw) {
            console.log('[MAP:getSidByRid] hit map rid→sid:', rid, '→', mappedSid)
            return mappedSid
        }
        console.warn('[MAP:getSidByRid] stale map; SID missing. Cleaning… rid=', rid, 'sid=', mappedSid)
        await c.del(mapKey)
    }

    if (!userId) {
        console.log('[MAP:getSidByRid] refresh not found; cannot salvage rid=', rid)
        return null
    }

        // 1a) Validate mapped SID -> ensure session exists
    if (mappedSid) {
        const raw = await c.get(sKey(mappedSid))
        if (raw) {
            console.log('[MAP:getSidByRid] hit map rid→sid:', rid, '→', mappedSid)
            return mappedSid
        }
        console.warn('[MAP:getSidByRid] stale map; SID missing. Cleaning… rid=', rid, 'sid=', mappedSid)
        await c.del(mapKey)
    }

        // 2) No map or stale map — without a refresh record we can't salvage
    if (!userId) {
        console.log('[MAP:getSidByRid] refresh not found; cannot salvage rid=', rid)
        return null
    }

        // 3) Salvage: scan user’s SIDs and look for parent_rid === rid
    const sidSet = await c.smembers(uSKey(userId))
    if (!sidSet.length) {
        console.log('[MAP:getSidByRid] user has no SIDs; rid=', rid, 'uid=', userId)
        return null
    }

    const raws = await c.mget(sidSet.map(sKey))
    let candidate: string | null = null

    for (let i = 0; i < raws.length; i++) {
        const raw = raws[i]
        const sid = sidSet[i]
        const rec = safeParse<SessionRecord & { parent_rid?: string }>(raw)
        if (!rec) continue
        if (rec.parent_rid === rid) {
            candidate = sid
             break
        }
    }

    if (!candidate) {
        console.log('[MAP:getSidByRid] no session with parent_rid match; rid=', rid, 'uid=', userId)
        return null
    }

    console.log('[MAP:getSidByRid] salvaged rid→sid via parent_rid:', rid, '→', candidate)

        // 4) Repair the map for next time (OPTIONAL: align TTL to session TTL)
    try {
        const sessRaw = await c.get(sKey(candidate))
        const sess = safeParse<SessionRecord>(sessRaw)
        if (sess) {
            const ttlSec = Math.max(1, Math.floor((sess.exp - Date.now()) / 1000))
            const tx = c.multi()
            tx.set(mapKey, candidate)
            tx.expire(mapKey, ttlSec) // keep map fresh & self-cleaning
            await tx.exec()
        } else {
            await c.set(mapKey, candidate)
        }
    } catch (e) {
        console.warn('[MAP:getSidByRid] map repair failed:', e)
    }

    return candidate
}

/* ---------------------------------------------------------------------- */

export async function getRidLastRefreshAt(
    userId: string,
    rid: string
): Promise<{ ms: number | null; iso: string | null; source: 'created_at' | 'rotated_at' | null }> {
    const c = getClient()
    if (c.status === 'wait' || c.status === 'end') await c.connect()

    console.log('[RF:lastTs] uid=', userId, 'rid=', rid)
    const vals = await c.hgetall(rKey(rid))
    if (!vals || Object.keys(vals).length === 0) {
        console.log('[RF:lastTs] not found')
        return { ms: null, iso: null, source: null }
    }

    if (vals.user_id && vals.user_id !== userId) {
        console.warn('[RF:lastTs] user mismatch; expected=', userId, 'found=', vals.user_id)
        return { ms: null, iso: null, source: null }
    }

    const poisoned = vals.poisoned === '1'
    const createdAt = vals.created_at ? Number(vals.created_at) : 0
    const rotatedAt = vals.rotated_at ? Number(vals.rotated_at) : 0

    let ms = 0
    let source: 'created_at' | 'rotated_at' | null = null

    if (poisoned && rotatedAt > 0) {
        ms = rotatedAt
        source = 'rotated_at'
    } else if (createdAt > 0) {
        ms = createdAt
        source = 'created_at'
    } else {
        console.log('[RF:lastTs] no timestamps present')
        return { ms: null, iso: null, source: null }
    }

    const iso = new Date(ms).toISOString()
    console.log('[RF:lastTs] source=', source, 'ms=', ms, 'iso=', iso)
    return { ms, iso, source }
}

/* ---------------------------------------------------------------------- */

async function getRotatedToFromOldRaw(userId: string, oldRid: string): Promise<string | null> {
    const c = getClient()
    if (c.status === 'wait' || c.status === 'end') await c.connect()
    const vals = await c.hgetall(rKey(oldRid))
    if (!vals || Object.keys(vals).length === 0) return null
    if (vals.user_id && vals.user_id !== userId) return null
    const rotatedTo = vals.rotated_to
    if (rotatedTo && String(rotatedTo).length > 0) return String(rotatedTo)
    return null
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */