/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { redirect } from 'next/navigation'
import { read as readSession } from '@/server/auth/reader'
import PasswordChangeForm from './_com/password-change-form'
import FooterBar from '@/app/_com/chrome-footer'

/* ---------------------------------------------------------------------- */

export const metadata = { title: 'Change Password' }

/* ---------------------------------------------------------------------- */

export default async function Page() {
    const sess = await readSession()

    if(!sess) {
        redirect('/login')
    }

    if(!sess.claims.force_password_change) {
        redirect('/login')
    }    

    return (
    <div className="min-h-svh flex flex-col">
        <div className="flex-1 flex items-center justify-center">
            <PasswordChangeForm/>
        </div>
        <FooterBar/>
    </div>
    )
}
