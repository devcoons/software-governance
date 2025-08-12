import Redis from 'ioredis';
import {
  REDIS_HOST, REDIS_PORT,  REDIS_PASSWORD,
} from '@/auth.config';

const redis = new Redis({
  host: REDIS_HOST, port: REDIS_PORT,
  username:  'default',
  password: REDIS_PASSWORD || undefined,
  lazyConnect: true, enableReadyCheck: true,
  maxRetriesPerRequest: null,
});

async function ensure() { if (redis.status === 'end' || redis.status === 'close') { try { await redis.connect(); } catch {} } }

export async function rateLimit(key: string, max: number, windowSec: number) {
  await ensure();
  const now = Math.floor(Date.now() / 1000);
  const bucket = `rl:${key}:${Math.floor(now / windowSec)}`;
  const count = await redis.incr(bucket);
  if (count === 1) await redis.expire(bucket, windowSec);
  return { allowed: count <= max, remaining: Math.max(0, max - count) };
}
