import { NextResponse } from 'next/server';
import { pingDb } from '@/lib/db/core';
import { pingRedis } from '@/lib/conn/redis'
// src/lib/redis.health.ts  <-- put in its own file; do NOT import your global client here

export const runtime = 'nodejs';

export async function GET() 
{
  try 
  {
    const [db, redis] = await Promise.allSettled([pingDb(), pingRedis()]);
    const dbOk = db.status === 'fulfilled' && db.value === true;
    const redisOk = redis.status === 'fulfilled' && redis.value === true;
    const ok = dbOk && redisOk;
    return NextResponse.json({ ok, db: dbOk, redis: redisOk });
  }
  catch
  {
    return NextResponse.json({ ok:false, db: undefined, redis: undefined });
  }
}
