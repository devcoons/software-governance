/* password-change-form.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

/* ---------------------------------------------------------------------- */

export default function PasswordChangeForm() {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/password-change', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newPassword: a, confirm: b }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'change_failed')
        setLoading(false)
        return
      }
      setOk(true)
      setTimeout(() => router.replace('/dashboard'), 200)
    } catch {
      setError('network_error')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-3">
      <input
        className="w-full border px-3 py-2"
        placeholder="new password"
        type="password"
        value={a}
        onChange={(e) => setA(e.target.value)}
        autoComplete="new-password"
      />
      <input
        className="w-full border px-3 py-2"
        placeholder="confirm new password"
        type="password"
        value={b}
        onChange={(e) => setB(e.target.value)}
        autoComplete="new-password"
      />
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {ok && <div className="text-green-700 text-sm">Password changed</div>}
      <button className="border px-4 py-2" disabled={loading}>
        {loading ? '…' : 'Update'}
      </button>
    </form>
  )
}
