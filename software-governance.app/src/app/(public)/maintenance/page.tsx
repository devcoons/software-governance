/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { redirect } from 'next/navigation'
import { Suspense } from 'react';

/* ---------------------------------------------------------------------- */

export const metadata = { title: 'Maintenance' }

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------- */

async function isHealthy(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

/* ---------------------------------------------------------------------- */

export default async function Page() {
  const healthy = await isHealthy()
  if (healthy) {
    redirect('/dashboard')
  }
  const HealthPoller = (await import('./_com/polling')).default;
  return  <Suspense><HealthPoller /></Suspense>;
  
}

