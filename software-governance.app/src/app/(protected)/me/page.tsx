/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import Chrome from '@/app/_com/chrome'
import { getSessionOrBridge } from '@/server/auth/ctx'
import ChangePasswordCard from './_com/change-password-card';
import TotpSetupCard from './_com/totp-card';
import { getUserProfileById } from '@/server/db/user-profile-repo';
import ProfileCard from './_com/profile-card';
import AccountCard from './_com/account-card';
import { toSessionView } from '@/app/_com/utils';



/* ---------------------------------------------------------------------- */

export const metadata = { title: 'My Profile' }
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------- */

export default async function Page() {
    const session = await getSessionOrBridge(); 
    const sessionView = toSessionView(session);

    const userProfile = await getUserProfileById(session.user_id)
    
    return (
    <Chrome session={sessionView}>
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-16 py-8">
            <h1 className="text-2xl font-bold mb-6">My Profile</h1>
            <div className="grid md:grid-cols-2 md:items-start gap-8">
                <div className="flex flex-col gap-8">
                    <ProfileCard { ...userProfile} />
                    <AccountCard sid={session.sid} user_id={session.user_id} claims={session.claims} />
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
