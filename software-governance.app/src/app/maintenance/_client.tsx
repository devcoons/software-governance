'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function MaintenanceClient() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const hr = await fetch('/api/health/ready', { cache: 'no-store' });
        if (hr.ok) {
          const h = await hr.json();
          if (h?.ok) {
            const sr = await fetch('/api/session/check', { cache: 'no-store', credentials: 'include' });
            if (!cancelled) router.replace(sr.ok ? '/dashboard' : '/login');
            return;
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) timer.current = setTimeout(tick, 3000);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);

  return (
    <main className="min-h-dvh flex items-center justify-center bg-white text-gray-900 p-6">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold mb-2">Service temporarily unavailable</h1>
        <p className="text-gray-600 text-sm">
          Database or cache is down. We’ll redirect automatically when service resumes.
        </p>
      </div>
    </main>
  );
}
