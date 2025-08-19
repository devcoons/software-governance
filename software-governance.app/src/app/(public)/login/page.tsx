/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { redirect } from 'next/navigation'
import LoginForm from './_com/login-form'
import FooterBar from '@/app/_com/chrome-footer'
import { getCurrentSession } from '@/server/auth/ctx'

/* ---------------------------------------------------------------------- */

export const metadata = { title: 'Login' }

/* ---------------------------------------------------------------------- */

export default async function Page() {

  const session = await getCurrentSession()
  if (session) {
    if (session.claims.force_password_change) {
        redirect('/password-change')
    } else {
        redirect('/dashboard')
    }
  }

  return (
      <div className="min-h-svh flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <LoginForm />
        </div>
        <FooterBar/>
      </div>
  )
}
