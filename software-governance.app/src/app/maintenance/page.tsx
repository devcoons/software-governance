import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function fetchHealth(timeoutMs = 1000) {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  if (!host) return { ok: false, db: false, redis: false };

  const base = `${proto}://${host}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/api/health/ready`, {
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, db: false, redis: false };
    return (await res.json()) as { ok: boolean; db: boolean; redis: boolean };
  } catch {
    return { ok: false, db: false, redis: false };
  } finally {
    clearTimeout(timer);
  }
}

export default async function MaintenancePage() {
  const { ok: healthy } = await fetchHealth(1000);

  if (healthy) {
    return redirect('/login');
  }

  // Only render UI when actually unhealthy
  const MaintenanceClient = (await import('./_client')).default;
  return <MaintenanceClient />;
}
