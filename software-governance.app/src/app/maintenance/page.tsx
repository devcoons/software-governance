import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/cookies';
import { sessionStore } from '@/lib/sstore.node';
import { pingDb } from '@/lib/db/core';
import { pingRedis } from '@/lib/sstore.node';
import MaintenanceClient from './_client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  // Server-side health check (no network, no cache)
  const [dbOk, redisOk] = await Promise.all([pingDb(), pingRedis()]);
  const healthy = dbOk && redisOk;

  if (healthy) {
    // Decide target before rendering anything
    const sid = (await cookies()).get(SESSION_COOKIE)?.value;
    if (sid) {
      const sess = await sessionStore.getSession(sid);
      if (sess) redirect('/dashboard');
    }
    redirect('/login');
  }

  // Only render UI when actually unhealthy
  return <MaintenanceClient />;
}
