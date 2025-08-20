/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/totp/redis-client.ts */
/* ---------------------------------------------------------------------- */

import config from '@/config'
import Redis from 'ioredis'

/* ---------------------------------------------------------------------- */

type Client = Redis

/* ---------------------------------------------------------------------- */

const g = globalThis as {
  __REDIS_CLIENT__?: Client | null;
  __REDIS_LAST_ERROR__?: string | null;
}

/* ---------------------------------------------------------------------- */

let client: Client | null = g.__REDIS_CLIENT__ ?? null
let lastError: string | null = g.__REDIS_LAST_ERROR__ ?? null

/* ---------------------------------------------------------------------- */

const _attached = new WeakSet<Client>();

function attachListeners(c: Client) {
  if (_attached.has(c)) return;
  _attached.add(c);

  c.on('error', (err: unknown) => {
    // preserve the exact message behavior, but without `any`
    lastError = String((err as { message?: unknown })?.message ?? err);
    g.__REDIS_LAST_ERROR__ = lastError;
  });

  c.on('end', () => {
    g.__REDIS_LAST_ERROR__ = lastError;
  });
}

/* ---------------------------------------------------------------------- */

function getClient(): Client {
  if (client) return client
  client = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    username: config.REDIS_USERNAME ?? undefined,
    password: config.REDIS_PASSWORD ?? undefined,
    lazyConnect: true,
    connectTimeout: 3000,
    maxRetriesPerRequest: 0,
    enableAutoPipelining: true,
  })
  attachListeners(client)
  g.__REDIS_CLIENT__ = client
  return client
}

/* ---------------------------------------------------------------------- */

export function getRedisLastError(): string | null {
  return lastError
}

/* ---------------------------------------------------------------------- */

export async function pingRedis(): Promise<{ ok: boolean; details?: string }> {
  const c = getClient()
  const t0 = Date.now()
  try {
    if (c.status === 'wait' || c.status === 'end') {
      await c.connect()
    } else if (c.status === 'connecting' || c.status === 'reconnecting') {
      return { ok: false, details: lastError || 'connecting' }
    }
    await c.ping()
    const ms = Date.now() - t0
    return { ok: true, details: `pong ${ms}ms` }
  } catch (e: unknown) {
    const msg = String((e as { message?: unknown })?.message ?? e) || lastError || 'redis error';

    return { ok: false, details: msg }
  }
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */