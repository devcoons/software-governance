/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { redirect } from 'next/navigation'
import { read as readSession } from '@/server/auth/reader'


/* ---------------------------------------------------------------------- */

export const metadata = { title: 'Maintenance' }

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------- */

async function isHealthy(): Promise<boolean> {
  try {
    const res = await fetch('/api/health/ready', { cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

/* ---------------------------------------------------------------------- */

export default async function Page() {
  const healthy = await isHealthy()
  if (healthy) {
    const sess = await readSession()
    if (!sess) redirect('/login')
    if (sess.claims.force_password_change) redirect('/password-change')
    redirect('/dashboard')
  }
  const HealthPoller = (await import('./_com/polling')).default;
  return <HealthPoller />;
  
}

