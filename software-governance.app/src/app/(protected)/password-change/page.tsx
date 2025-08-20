/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { redirect } from 'next/navigation'

import FooterBar from '@/app/_com/chrome-footer'
import PasswordChangeForm from './_com/pass-change-form'
import { getSessionOrBridge } from '@/server/auth/ctx';
import { getBoolClaim, getIntClaim } from '@/app/_com/utils';

/* ---------------------------------------------------------------------- */

export const metadata = { title: 'Change Password' }

/* ---------------------------------------------------------------------- */

export default async function Page() {
    const session = await getSessionOrBridge(true); 

    if(!session) {
        console.log("[ PG - /password-change ] - No valid session found (redirect:/login)")
        redirect('/login')
    }

    const forced_change = getBoolClaim(session.claims,'force_password_change')
    if(!forced_change) {
        console.log("[ PG - /password-change ] - No valid claims found (redirect:/login)")
        redirect('/login')
    }    

    if(!forced_change) {
        console.log("[ PG - /password-change ] - No force-change active (redirect:/login)")
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
