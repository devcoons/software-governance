/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FooterBar from '@/app/_com/chrome-footer'

/* ---------------------------------------------------------------------- */

export default function Page() {
  const router = useRouter()
  useEffect(() => {
    const ctrl = new AbortController()
    const tid = setTimeout(async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', signal: ctrl.signal })
      } catch {}
      router.replace('/login')
    }, 500)
    return () => {
      ctrl.abort()
      clearTimeout(tid)
    }
  }, [router])
  
  return (
    <div className="min-h-svh flex flex-col bg-white">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
            <div
              className="mx-auto mb-6 h-10 w-10 rounded-full border-2 border-gray-300 border-t-transparent animate-spin"
              aria-hidden="true"
            />
            <h1 className="text-lg font-medium">Signing you out</h1>
            <p className="mt-2 text-sm text-gray-600">Cleaning session… please wait.</p>
          </div>
        </div>
      </div>
      <FooterBar />
    </div>
        )
}
