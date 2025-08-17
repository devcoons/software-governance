'use client'

/* user-profile-view.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { useEffect, useState } from 'react'
import type { DbUserProfile } from '@/server/db/user-profile-repo'

/* ---------------------------------------------------------------------- */

type Props = Readonly<{
    userId: string
    email?: string
    onClose: () => void
}>

/* ---------------------------------------------------------------------- */

export default function UserProfileView({ userId, email, onClose }: Props) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [profile, setProfile] = useState<DbUserProfile | null>(null)

    useEffect(() => {
        let alive = true
        ;(async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(`/api/admin/users/profile?userId=${encodeURIComponent(userId)}`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { 'accept': 'application/json' }
                })
                const data = await res.json()
if (!res.ok || !data?.ok) {
    throw new Error(data?.error ?? 'failed_to_load_profile')
}

// Support both { ok, data: { ...profile }} and { ok, ...profile }
const raw = data.data ?? data

// Support both snake_case and camelCase from repo/API
const profileParsed = {
    user_id: raw.user_id ?? raw.userId,
    first_name: raw.first_name ?? raw.firstName ?? '',
    last_name: raw.last_name ?? raw.lastName ?? '',
    phone_number: raw.phone_number ?? raw.phoneNumber ?? '',
    timezone: raw.timezone ?? raw.timeZone ?? ''
}

setProfile(profileParsed as any)
if (!profileParsed.user_id) {
    console.warn('Profile payload missing user id:', data)
}
                if (alive) {
                    // data is { ok: true, ...profile }
                    const { user_id, first_name, last_name, phone_number, timezone } = data
                    setProfile({ user_id, first_name, last_name, phone_number, timezone })
                }
            } catch (e: any) {
                if (alive) setError(e?.message ?? 'failed_to_load_profile')
            } finally {
                if (alive) setLoading(false)
            }
        })()
        return () => { alive = false }
    }, [userId])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="card bg-base-100 w-full max-w-lg shadow-xl border border-base-300">
                <div className="card-body">
                    <div className="flex items-center justify-between">
                        <h3 className="card-title">User profile</h3>
                        <button className="btn btn-sm" onClick={onClose}>Close</button>
                    </div>

                    {email ? (
                        <div className="text-sm opacity-80 mb-2">Email: <span className="font-mono">{email}</span></div>
                    ) : null}

                    {loading && (
                        <div className="flex items-center gap-2">
                            <span className="loading loading-spinner loading-sm"></span>
                            <span>Loading…</span>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="alert alert-error">
                            <span className="font-medium">Error:</span> <span className="truncate">{error}</span>
                        </div>
                    )}

                    {!loading && profile && (
                        <ul className="grid grid-cols-3 gap-y-3 text-sm">
                            <li className="font-medium">First name</li>
                            <li className="col-span-2">{profile.first_name || <span className="opacity-60">—</span>}</li>

                            <li className="font-medium">Last name</li>
                            <li className="col-span-2">{profile.last_name || <span className="opacity-60">—</span>}</li>

                            <li className="font-medium">Phone</li>
                            <li className="col-span-2">{profile.phone_number || <span className="opacity-60">—</span>}</li>

                            <li className="font-medium">Timezone</li>
                            <li className="col-span-2">{profile.timezone || <span className="opacity-60">—</span>}</li>
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}
