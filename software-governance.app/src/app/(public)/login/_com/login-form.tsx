/* login-form.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/* ---------------------------------------------------------------------- */

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const qs = useSearchParams()
  const next = qs.get('next') || '/dashboard'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    
    setError(null)
    if (!email || !password) { setError('Enter email and password.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login:email, password:password, rememberMe: remember }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        console.log(res);
        setError(data?.error || 'login_failed')
        setLoading(false)
        return
      }
      if (data.force_password_change) {
        router.replace('/password-change')
      } else {
        router.replace(next)
      }
    } catch (err: any) {
      setError('Network error. Try again.');
      setLoading(false)
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
                autoComplete="password"
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
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="flex items-center justify-between pt-2 text-sm">
              <label className="inline-flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
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
  )
}
