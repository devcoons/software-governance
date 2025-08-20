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
    const needsPwdChange = (() => {
        const c = session.claims as unknown
        if (typeof c !== 'object' || c === null) return false
        const v = (c as Record<string, unknown>)['force_password_change']
        // accept boolean or common string encodings
        if (typeof v === 'boolean') return v
        if (typeof v === 'string') return v === 'true' || v === '1'
        if (typeof v === 'number') return v === 1
        return false
    })()

    if (needsPwdChange) {
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
