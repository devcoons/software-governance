// src/components/login_form.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/session/check', { cache: 'no-store', credentials: 'include' });
        if (!cancelled && r.ok) {
          const data = await r.json();
          if (data?.ok) router.replace('/dashboard');
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();                 // ← prevent native POST
    setError(null);
    if (!email || !password) { setError('Enter email and password.'); return; }
    setPending(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, next }),  // pass next (server will sanitize)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Login failed.');
        setPending(false);
        return;
      }
      window.location.replace(data.redirect || '/dashboard');  // server chooses force-change or next
    } catch {
      setError('Network error. Try again.');
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md px-6 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-gray-600">Access your account</p>
      </div>

      <div className="rounded-2xl border border-gray-200 shadow-sm">
        <form onSubmit={onSubmit} className="p-6" noValidate>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-800">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary w-full"
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="flex items-center justify-between pt-2 text-sm">
              <a href={`/forgot-password?next=${encodeURIComponent(next)}`} className="link link-primary">
                Forgot password?
              </a>
             
            </div>
          </div>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-gray-500">
        By signing in you agree to the Terms and Privacy Policy.
      </p>
    </div>
  );
}
