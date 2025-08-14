/* provider.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import type { SessionStore } from './store.i'
import { memoryStore } from './store-mem'
import { redisStore } from './store-redis'
import config from '@/config'

/* ---------------------------------------------------------------------- */

const g = globalThis as any

/* ---------------------------------------------------------------------- */

function choose(): SessionStore {
  const force = String(process.env.SESSION_STORE || '').trim().toLowerCase()
  if (force === 'memory') return memoryStore

  const hasRedis =
    Boolean(config.REDIS_HOST) &&
    Number(config.REDIS_PORT) > 0

  if (hasRedis) return redisStore
  return memoryStore
}

/* ---------------------------------------------------------------------- */

export const store: SessionStore = g.__SESSION_STORE__ || choose()
g.__SESSION_STORE__ = store