import { redirect } from 'next/navigation';

function safeNext(n?: string) {
  if (!n) return '/dashboard';
  if (!n.startsWith('/') || n.startsWith('//')) return '/dashboard';
  return n;
}

export default async function RefreshPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);

  try {
    const res = await fetch('/api/session/refresh', { cache: 'no-store' });
    if (res.ok) redirect(next);
  } catch {}

  redirect(`/login?next=${encodeURIComponent(next)}`); // ← use /login
}
