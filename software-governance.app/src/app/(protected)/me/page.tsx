/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import Chrome from '@/app/_com/chrome'
import { getSession } from '@/server/auth/ctx'
import ChangePasswordCard from './_com/change-password-card';
import TotpSetupCard from './_com/totp-card';

/* ---------------------------------------------------------------------- */

export const metadata = { title: 'My Profile' }
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------- */

export default async function Page() {
  const sess = await getSession()
  return (
<Chrome>
      <div className="max-w-screen-xl mx-auto px-4 lg:px-16 py-8">
        <h1 className="text-2xl font-bold mb-6">My Profile</h1>
            <div className="grid md:grid-cols-2 md:items-start gap-8">
                <div className="card bg-base-100 shadow-md border border-base-300 self-start">
                    <div className="card-body">
                    <h2 className="card-title">Account Details</h2>
                    <p className="text-sm opacity-70 mb-4">Welcome, {sess?.claims.email}</p>
                    <ul className="text-sm space-y-2">
                        <li><span className="font-medium">User ID:</span> {sess?.claims.id}</li>
                        <li><span className="font-medium">Roles:</span> {sess?.claims.roles?.join(', ') || '(none)'}</li>
                        <li><span className="font-medium">Permissions:</span> {sess?.claims.permissions?.join(', ') || '(none)'}</li>
                    </ul>
                    </div>
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
