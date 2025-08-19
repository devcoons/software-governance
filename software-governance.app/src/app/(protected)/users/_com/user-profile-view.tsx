'use client'

import { useEffect, useState } from 'react'
import type { DbUserProfile } from '@/server/db/user-profile-repo'

type Props = Readonly<{
  userId: string
  email?: string
  onClose: () => void
}>

function normalizeProfile(input: any): DbUserProfile {
  const raw = input?.data ?? input ?? {}
  return {
    user_id: raw.user_id ?? raw.userId ?? '',
    first_name: raw.first_name ?? raw.firstName ?? '',
    last_name: raw.last_name ?? raw.lastName ?? '',
    phone_number: raw.phone_number ?? raw.phoneNumber ?? '',
    timezone: raw.timezone ?? raw.timeZone ?? '',
  } as DbUserProfile
}

export default function UserProfileView({ userId, email, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<DbUserProfile | null>(null)

  useEffect(() => {
    if (!userId) return

    // Delay to the next microtask to avoid dev double-mount edge cases
    const t = setTimeout(() => {
      const ac = new AbortController()
      const { signal } = ac
      const url = `/api/users/profile?userId=${encodeURIComponent(userId)}`

      ;(async () => {
        setLoading(true)
        setError(null)
        try {
          
          console.debug('[UserProfileView] GET', url)

          const res = await fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { accept: 'application/json' },
            signal,
          })

          if (!res.ok) {
            const msg = res.status === 401 ? 'unauthorized' : `http_${res.status}`
            throw new Error(msg)
          }

          const payload = await res.json().catch(() => ({}))
          const normalized = normalizeProfile(payload)
          setProfile(normalized)
        } catch (e: any) {
          if (signal.aborted) return
          setError(e?.message ?? 'failed_to_load_profile')
          setProfile(null)
        } finally {
          if (!signal.aborted) setLoading(false)
        }
      })()

      // cleanup abort
      return () => ac.abort()
    }, 0)

    return () => clearTimeout(t)
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
            <div className="text-sm opacity-80 mb-2">
              Email: <span className="font-mono">{email}</span>
            </div>
          ) : null}

          {loading && (
            <div className="flex items-center gap-2">
              <span className="loading loading-spinner loading-sm" />
              <span>Loading…</span>
            </div>
          )}

          {!loading && error && (
            <div className="alert alert-error">
              <span className="font-medium">Error:</span>{' '}
              <span className="truncate">{error}</span>
            </div>
          )}

          {!loading && !error && profile && (
            <ul className="grid grid-cols-3 gap-y-3 text-sm">
              <li className="font-medium">First name</li>
              <li className="col-span-2">
                {profile.first_name || <span className="opacity-60">—</span>}
              </li>

              <li className="font-medium">Last name</li>
              <li className="col-span-2">
                {profile.last_name || <span className="opacity-60">—</span>}
              </li>

              <li className="font-medium">Phone</li>
              <li className="col-span-2">
                {profile.phone_number || <span className="opacity-60">—</span>}
              </li>

              <li className="font-medium">Timezone</li>
              <li className="col-span-2">
                {profile.timezone || <span className="opacity-60">—</span>}
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
