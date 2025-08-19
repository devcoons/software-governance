'use client'

import { useState, FormEvent } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function ChangePasswordCard() {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [status, setStatus] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const next = pathname + (searchParams.size ? `?${searchParams.toString()}` : '')

    async function handleChangePassword(e: FormEvent) {
        e.preventDefault()

        if (!currentPassword || !newPassword || !confirmPassword) {
            setStatus('❌ Please fill out all fields.')
            return
        }

        if (newPassword !== confirmPassword) {
            setStatus('❌ New passwords do not match.')
            return
        }

        setStatus(null)
        setBusy(true)
        try {
            const res = await fetch('/api/me/update-password', {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            })

            const isJson = res.headers.get('content-type')?.includes('application/json')
            const data = isJson ? await res.json() : {}

            if (res.status === 401 && data?.error && data.error !== 'invalid_current_password') {
                router.replace(`/login?next=${encodeURIComponent(next)}&reason=${encodeURIComponent(data.error)}`)
                return
            }

            if (!res.ok || !data?.ok) {
                const map: Record<string, string> = {
                invalid_json: 'Invalid request.',
                invalid_payload: 'Please check the fields.',
                invalid_current_password: 'Current password is incorrect.',
                password_unchanged: 'New password must be different.',
                weak_password: 'Password too weak (need upper, lower, digit).',
                user_not_active: 'Account is inactive.',
                update_failed: 'Could not update password. Try again.',
                }
                const msg = map[data?.error as string] ?? `Failed to update password. (${res.status})`
                setStatus(`❌ ${msg}`)
                return
            }
            setStatus('✅ Password updated. Redirecting to sign in…')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            const loginUrl = `/login?next=${encodeURIComponent(next)}`
            await new Promise((r) => setTimeout(r, 1800)) 
            return router.replace(loginUrl)
        } catch (err: any) {
            setStatus(`❌ ${err?.message ?? 'Network error. Try again.'}`)
        } finally {
            setBusy(false)
        }
    }

    return (
    <div className="card bg-base-100 shadow-md border border-base-300">
        <div className="card-body">
            <h2 className="card-title">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
            <input
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input input-bordered w-full"
                required
                disabled={busy}
            />
            <input
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input input-bordered w-full"
                required
                disabled={busy}
            />
            <input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input input-bordered w-full"
                required
                disabled={busy}
            />

            <button className="btn btn-primary w-full" disabled={busy}>
                {busy ? 'Updating…' : 'Change Password'}
            </button>
            </form>

            {status && <p className="text-sm mt-3">{status}</p>}
        </div>
    </div>
    )
}
