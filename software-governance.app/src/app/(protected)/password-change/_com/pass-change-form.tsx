/* ---------------------------------------------------------------------- */
/* Filepath: /src/app/(protected)/password-change/_com/pass-change-form.tsx */
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
        const res = await fetch('/api/me/force-update-password', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ newPassword: a }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.ok) {
            setError(data?.error ?? 'change_failed')
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
    <div className="w-full max-w-md px-6 py-10">
        <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold">Change Password</h1>
            <p className="mt-1 text-sm text-gray-600">Please ensure you complete this step to avoid locking your account.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <form onSubmit={onSubmit} className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-800">New Password</label>
                    <input type="password"
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                            onChange={(e) => setA(e.target.value)} value={a} autoComplete="new-password"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-800">Confirmation</label>
                    <input type="password"
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                            onChange={(e) => setB(e.target.value)} value={b} autoComplete="new-password"/>
                </div>  
                {error && <div className="text-red-600 text-sm">{error}</div>}
                {ok && <div className="text-green-700 text-sm">Password changed</div>}
                <button className="btn btn-primary w-full" disabled={loading}>
                    {loading ? '…' : 'Update'}
                </button>
            </form>    
        </div>
    </div>
    )
}
