import {
  REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD,
} from '@/auth.config';

import Redis from 'ioredis';
import { NextResponse } from 'next/server';
import { pingDb } from '@/lib/db/core';

export const runtime = 'nodejs';

/* -------------------- Redis client (module-scoped) -------------------- */

export const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  username: REDIS_USERNAME || undefined,
  password: REDIS_PASSWORD || undefined,
  lazyConnect: true,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 200, 2000),
  maxRetriesPerRequest: null,
});

redisClient.on('error', () => {});
redisClient.on('ready', () => {});
redisClient.on('close', () => {});
redisClient.on('end', () => {});

/* -------------------- Health probe helpers -------------------- */

export async function pingRedis(timeoutMs = 800): Promise<boolean> {
  const deadline = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  try {
    await Promise.race([redisClient.connect(), deadline(timeoutMs)]);
    if (redisClient.status !== 'ready') return false;

    const pong = await Promise.race<string | undefined>([
      redisClient.ping() as Promise<string>,
      new Promise<string | undefined>((resolve) =>
        setTimeout(() => resolve(undefined), timeoutMs),
      ),
    ]);
    return pong === 'PONG';
  } catch {
    return false;
  } finally {
    try { await redisClient.quit(); } catch {}
    try { redisClient.disconnect(); } catch {}
  }
}

/* -------------------- 3s memoization + in-flight sharing -------------------- */

type Health = { ok: boolean; db: boolean; redis: boolean };

const TTL_MS = 3000;

let lastHealth: Health | null = null;
let lastCheckedAt = 0;
let inFlight: Promise<Health> | null = null;

async function computeHealth(): Promise<Health> {
  const [db, redis] = await Promise.allSettled([pingDb(), pingRedis()]);
  const dbOk = db.status === 'fulfilled' && db.value === true;
  const redisOk = redis.status === 'fulfilled' && redis.value === true;
  return { ok: dbOk && redisOk, db: dbOk, redis: redisOk };
}

async function getHealth(): Promise<Health> {
  const now = Date.now();

  // Fresh enough → serve cached
  if (lastHealth && now - lastCheckedAt < TTL_MS) return lastHealth;

  // Someone already probing → await it
  if (inFlight) return inFlight;

  // Start a new probe
  inFlight = computeHealth()
    .then((res) => {
      lastHealth = res;
      lastCheckedAt = Date.now();
      return res;
    })
    .catch(() => {
      // Keep prior result on failure; if none, return a conservative "down"
      return lastHealth ?? { ok: false, db: false, redis: false };
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/* -------------------- Route handler -------------------- */

export async function GET() {
  try {
    const health = await getHealth();
    // We’re doing in-process memoization; avoid external caches.
    return NextResponse.json(health, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { ok: false, db: undefined, redis: undefined },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
