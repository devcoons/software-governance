import {
  REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD,
  SESSION_PREFIX, REFRESH_PREFIX,
  USER_SESSIONS_PREFIX, USER_REFRESH_PREFIX,
  SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS,
} from '@/auth.config';

import Redis from 'ioredis';

/* ------------------------------------------------------- */
/* ------------------------------------------------------- */
/* ------------------------------------------------------- */

const redisClient = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    username: REDIS_USERNAME || undefined,
    password: REDIS_PASSWORD || undefined,
    lazyConnect: true,            
    enableReadyCheck: false,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
    connectTimeout: 1500,
});

/* ------------------------------------------------------- */
/* ------------------------------------------------------- */

redisClient.on('error', () => { });
redisClient.on('ready', () => { });
redisClient.on('close', () => { });
redisClient.on('end', () => { });

/* ------------------------------------------------------- */
/* ------------------------------------------------------- */

export async function pingRedis(timeoutMs = 800): Promise<boolean> 
{
  const deadline = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
  try {
    await Promise.race([redisClient.connect(), deadline(timeoutMs)]);
    if (redisClient.status !== 'ready') return false;
    const pong = await Promise.race<string | undefined>([
      redisClient.ping() as Promise<string>,
      new Promise<string | undefined>(resolve => setTimeout(() => resolve(undefined), timeoutMs)),
    ]);
    return pong === 'PONG';
  } catch {
    return false;
  } finally {
    try { await redisClient.quit(); } catch { }
    try { redisClient.disconnect(); } catch { }
  }
}