/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { redirect } from 'next/navigation'
import { read as readSession } from '@/server/auth/reader'
import LoginForm from './_com/login-form'
import ChromeLight from '@/app/_com/chrome-light'
import FooterBar from '@/app/_com/chrome-footer'

/* ---------------------------------------------------------------------- */

export const metadata = { title: 'Login' }

/* ---------------------------------------------------------------------- */

export default async function Page() {
  const sess = await readSession()
  if (sess) {
    if (sess.claims.force_password_change) {
      redirect('/auth/password-change')
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
