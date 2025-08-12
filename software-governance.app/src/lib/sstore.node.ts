// src/lib/sstore.node.ts
import Redis from 'ioredis';
import {
  REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD,
  SESSION_PREFIX, REFRESH_PREFIX,
  USER_SESSIONS_PREFIX, USER_REFRESH_PREFIX,
  SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS,
} from '@/auth.config';

export type Claims = {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  // optional flags mirrored from DB if you add them to claims
  totp_enabled?: boolean;
  forcePasswordChange?: boolean;
};

export type SessionRec = { claims: Claims; createdAt: number; lastSeenAt: number };
export type RefreshRec = { claims: Claims; createdAt: number };

const LAST_SEEN_WRITE_INTERVAL = 60;

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  username: REDIS_USERNAME || undefined,   
  password: REDIS_PASSWORD || undefined,
  lazyConnect: true,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 200, 2000),
  maxRetriesPerRequest: null,
});

let loggedError = false;
redis.on('error', (err) => {
  if (!loggedError) {
    console.warn('[redis] connection error:', err?.message || err);
    loggedError = true;
  }
});
redis.on('ready', () => {
  if (loggedError) console.info('[redis] connected');
  loggedError = false;
});

async function ensure() {
  const s = redis.status; // 'wait' | 'connecting' | 'ready' | 'reconnecting' | 'end' | 'close'
  if (s === 'ready' || s === 'connecting' || s === 'reconnecting') return;
  try { await redis.connect(); } catch {/* swallow; caller may retry */}
}


// Compatibility method for old imports
export async function pingRedis(): Promise<boolean> {
  await ensure();
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export const sessionStore = {
  // SESSION (short-lived)
  async createSession(claims: Claims) {
    await ensure();
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const rec: SessionRec = { claims, createdAt: now, lastSeenAt: now };

    await Promise.all([
      redis.set(SESSION_PREFIX + id, JSON.stringify(rec), 'EX', SESSION_TTL_SECONDS),
      redis.sadd(USER_SESSIONS_PREFIX + claims.userId, id),
    ]);

    return id;
  },

async getSession(id: string): Promise<SessionRec | null> {
  await ensure();
  const key = SESSION_PREFIX + id;
  // atomically get and extend TTL
  // @ts-ignore ioredis >= 5 supports GETEX; add typing if needed
  const raw: string | null = await (redis as any).getex(key, 'EX', SESSION_TTL_SECONDS);
  if (!raw) return null;

  const rec = JSON.parse(raw) as SessionRec;
  const now = Math.floor(Date.now() / 1000);
  if (now - (rec.lastSeenAt ?? 0) >= LAST_SEEN_WRITE_INTERVAL) {
    rec.lastSeenAt = now;
    // Best-effort write; TTL already extended by GETEX
    await redis.set(key, JSON.stringify(rec), 'KEEPTTL');
  }
  return rec;
},

  async touchSession(id: string) {
    await ensure();
    const key = SESSION_PREFIX + id;
    const raw = await redis.get(key);
    if (!raw) return;
    const rec = JSON.parse(raw) as SessionRec;
    rec.lastSeenAt = Math.floor(Date.now() / 1000);
    await redis.set(key, JSON.stringify(rec), 'EX', SESSION_TTL_SECONDS);
  },

  async revokeSession(id: string) {
    await ensure();
    const key = SESSION_PREFIX + id;
    const raw = await redis.get(key);
    if (raw) {
      const rec = JSON.parse(raw) as SessionRec;
      await redis.srem(USER_SESSIONS_PREFIX + rec.claims.userId, id);
    }
    await redis.del(key);
  },

  // REFRESH (long-lived)
  async createRefresh(claims: Claims) {
    await ensure();
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const rec: RefreshRec = { claims, createdAt: now };

    await Promise.all([
      redis.set(REFRESH_PREFIX + id, JSON.stringify(rec), 'EX', REFRESH_TTL_SECONDS),
      redis.sadd(USER_REFRESH_PREFIX + claims.userId, id),
    ]);

    return id;
  },

  async getRefresh(id: string): Promise<RefreshRec | null> {
    await ensure();
    const raw = await redis.get(REFRESH_PREFIX + id);
    return raw ? (JSON.parse(raw) as RefreshRec) : null;
  },

  async revokeRefresh(id: string) {
    await ensure();
    const key = REFRESH_PREFIX + id;
    const raw = await redis.get(key);
    if (raw) {
      const rec = JSON.parse(raw) as RefreshRec;
      await redis.srem(USER_REFRESH_PREFIX + rec.claims.userId, id);
    }
    await redis.del(key);
  },

  async revokeAllForUser(userId: string) {
    await ensure();
    const [sessIds, refIds] = await Promise.all([
      redis.smembers(USER_SESSIONS_PREFIX + userId),
      redis.smembers(USER_REFRESH_PREFIX + userId),
    ]);

    if (sessIds.length) {
      await redis.del(...sessIds.map((i) => SESSION_PREFIX + i));
    }
    if (refIds.length) {
      await redis.del(...refIds.map((i) => REFRESH_PREFIX + i));
    }

    await Promise.all([
      redis.del(USER_SESSIONS_PREFIX + userId),
      redis.del(USER_REFRESH_PREFIX + userId),
    ]);

    return { sessions: sessIds.length, refreshes: refIds.length };
  },
};

async function readSessionQuick(id: string): Promise<SessionRec | null> {
  await ensure();
  const raw = await redis.get(SESSION_PREFIX + id);
  return raw ? (JSON.parse(raw) as SessionRec) : null;
}
export { readSessionQuick };


