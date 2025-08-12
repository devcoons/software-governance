import Redis from 'ioredis';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } from '../auth.config';

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD || undefined,
  lazyConnect: true,
});
async function ensure() { if (redis.status === 'end' || redis.status === 'close') try { await redis.connect(); } catch {} }

export async function limit(key: string, max: number, windowSec: number) {
  await ensure();
  const now = Math.floor(Date.now() / 1000);
  const k = `rl:${key}`;
  const count = await redis.incr(k);
  if (count === 1) await redis.expire(k, windowSec);
  const ttl = await redis.ttl(k);
  return { allow: count <= max, remaining: Math.max(0, max - count), reset: now + (ttl > 0 ? ttl : windowSec) };
}
