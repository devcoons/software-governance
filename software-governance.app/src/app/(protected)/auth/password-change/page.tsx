/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { redirect } from 'next/navigation'
import { read as readSession } from '@/server/auth/reader'
import PasswordChangeForm from './_com/password-change-form'

/* ---------------------------------------------------------------------- */

export const metadata = { title: 'Change Password' }

/* ---------------------------------------------------------------------- */

export default async function Page() {
  const sess = await readSession()

  if (!sess) {
    redirect('/login')
  }

  if (!sess.claims.force_password_change) {
    redirect('/dashboard')
  }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl">Change your password</h1>
      <PasswordChangeForm />
    </main>
  )
}
