/* health-poller.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/* ---------------------------------------------------------------------- */

export default function HealthPoller() {
  const router = useRouter()
  const qs = useSearchParams()
  const next = qs.get('next') ?? '/'

  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        if (res.ok && !stop) {
          router.replace(next)
          return
        }
      } catch {}
      if (!stop) setTimeout(tick, 2000)
    }
    const id = setTimeout(tick, 2000)
    return () => {
      stop = true
      clearTimeout(id)
    }
  }, [router, next])

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
