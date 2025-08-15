/* layout.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { read as readSession } from '@/server/auth/reader'

/* ---------------------------------------------------------------------- */

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const sess = await readSession()
  if (!sess) redirect('/login')
  if (sess.claims.force_password_change) redirect('/password-change')
  return <>{children}</>
}
