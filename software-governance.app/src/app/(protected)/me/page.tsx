/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import Chrome from '@/app/_com/chrome'
import { getSession } from '@/server/auth/ctx'
import ChangePasswordCard from './_com/change-password-card';
import TotpSetupCard from './_com/totp-card';
import { getUserProfileById } from '@/server/db/user-profile-repo';
import ProfileCard from './_com/profile-card';
import AccountCard from './_com/account-card';


/* ---------------------------------------------------------------------- */

export const metadata = { title: 'My Profile' }
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------- */

export default async function Page() {
    const sess = await getSession()

    const roles: string[] = Array.isArray(sess?.claims?.roles) ? sess!.claims!.roles as string[] : []
    const perms: string[] = Array.isArray(sess?.claims?.permissions) ? sess!.claims!.permissions as string[] : []
    const sid = sess?.sid ?? '(unknown)'
    const userId = sess?.user_id ?? '(unknown)'
    const totpEnabled = Boolean(sess?.claims?.totp_enabled)
    const userProfile = await getUserProfileById(sess?.user_id ?? '')

    return (
    <Chrome>
        <div className="max-w-screen-xl mx-auto px-4 lg:px-16 py-8">
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
