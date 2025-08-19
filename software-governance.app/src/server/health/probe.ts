/* probe.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import config from '@/config'
import { pingDb } from '@/server/db/mysql-client'
import { pingRedis } from '../db/redis-client'
import { HealthProbe } from '@/types/provider'

/* ---------------------------------------------------------------------- */

let cached      : HealthProbe | null = null
let inFlight    : Promise<HealthProbe> | null = null
let lastTs      = 0

/* ---------------------------------------------------------------------- */

async function timeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout:${tag}`)), ms)
        p.then(v => {
            clearTimeout(t)
            resolve(v)
        }).catch(e => {
            clearTimeout(t)
            reject(e)
        })
    })
}

/* ---------------------------------------------------------------------- */

export async function getHealth(): Promise<HealthProbe> {
    const now = Date.now()
    
    if (cached && now - lastTs < config.HEALTH_CACHE_MS)
        return cached
    
    if (inFlight) 
        return inFlight
  
    return (async () => {
        const deadline = Math.max(750, Math.min(2000, config.HEALTH_CACHE_MS))
        const [dbRes, redisRes] = await Promise.allSettled([
            timeout(pingDb(), deadline, 'db'),
            timeout(pingRedis(), deadline, 'redis'),
        ])
    
        const db = dbRes.status === 'fulfilled' ? dbRes.value : { ok: false, details: String(dbRes.reason) }
        const redis = redisRes.status === 'fulfilled' ? redisRes.value : { ok: false, details: String(redisRes.reason) }
        const ok = db.ok && redis.ok
        const res: HealthProbe = { ok, db, redis, ts: now }
        cached = res
        lastTs = now
        inFlight = null
        return res
    })()
}
