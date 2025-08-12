import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function RefreshPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = searchParams?.next || '/dashboard';
  try {
    const res = await fetch('/api/session/refresh', { method: 'POST', cache: 'no-store' });
    if (res.ok) redirect(next);
  } catch {}
  redirect(`/login?next=${encodeURIComponent(next)}`);
}

