import { NextResponse } from 'next/server';
import { pingDb } from '@/lib/db/core';
import { pingRedis } from '@/lib/sstore.node';

export const runtime = 'nodejs';

export async function GET() {
  const [db, redis] = await Promise.allSettled([pingDb(), pingRedis()]);
  const dbOk = db.status === 'fulfilled' && db.value === true;
  const redisOk = redis.status === 'fulfilled' && redis.value === true;
  const ok = dbOk && redisOk;
  return NextResponse.json({ ok, db: dbOk, redis: redisOk });
}
