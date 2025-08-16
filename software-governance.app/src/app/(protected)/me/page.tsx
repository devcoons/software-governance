/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import Chrome from '@/app/_com/chrome'
import { getSession, getSessionOrRedirect } from '@/server/auth/ctx'
import ChangePasswordCard from './_com/change-password-card';
import TotpSetupCard from './_com/totp-card';
import { getUserProfileById } from '@/server/db/user-profile-repo';
import ProfileCard from './_com/profile-card';
import AccountCard from './_com/account-card';
import { redirect } from 'next/navigation';



/* ---------------------------------------------------------------------- */

export const metadata = { title: 'My Profile' }
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------- */

export default async function Page() {
    const sess = await getSessionOrRedirect()

    console.log("[PG-ME]")
    console.log(sess)
    const sid = sess?.sid ?? '(unknown)'
    const userId = sess?.user_id ?? null

    if(!userId)
    {
        return redirect('/maintenance?next=/me')
    }
    else
    {
        const userProfile = await getUserProfileById(userId)
        return (
        <Chrome>
            <div className="max-w-screen-2xl mx-auto px-4 lg:px-16 py-8">
                <h1 className="text-2xl font-bold mb-6">My Profile</h1>
                <div className="grid md:grid-cols-2 md:items-start gap-8">
                    <div className="flex flex-col gap-8">
                        <ProfileCard { ...userProfile} />
                        <AccountCard sid={sid} user_id={userId} claims={sess?.claims} />
                    </div>
                    <div className="flex flex-col gap-8">
                        <ChangePasswordCard/>
                        <TotpSetupCard/>
                    </div>
                </div>
            </div>
        </Chrome>
        )
    }
}
