import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';

import { sessionStore } from '@/lib/sstore.node';
import Chrome from '@/components/chrome';
import TotpSetupCard from '@/app/users/me/TotpSetupCard';
import ChangePasswordCard from '@/app/users/me/ChangePasswordCard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid) redirect('/auth/refresh?next=' + encodeURIComponent('/users/me'));

  const sess = await sessionStore.getSession(sid);
  if (!sess) redirect('/auth/refresh?next=' + encodeURIComponent('/users/me'));

  const { claims } = sess;
  const totpEnabled = (claims as any).totp_enabled ?? false;

  return (
    <Chrome>
      <div className="max-w-screen-xl mx-auto px-4 lg:px-16 py-8">
        <h1 className="text-2xl font-bold mb-6">My Profile</h1>

        <div className="grid md:grid-cols-2 md:items-start gap-8">
  {/* Left column */}
  <div className="card bg-base-100 shadow-md border border-base-300 self-start">
    <div className="card-body">
      <h2 className="card-title">Account Details</h2>
      <p className="text-sm opacity-70 mb-4">Welcome, {claims.email}</p>
      <ul className="text-sm space-y-2">
        <li><span className="font-medium">User ID:</span> {claims.sub}</li>
        <li><span className="font-medium">Roles:</span> {claims.roles?.join(', ') || '(none)'}</li>
        <li><span className="font-medium">Permissions:</span> {claims.permissions?.join(', ') || '(none)'}</li>
      </ul>
    </div>
  </div>

  {/* Right column */}
  <div className="flex flex-col gap-8">
    <ChangePasswordCard />
    <TotpSetupCard initialEnabled={totpEnabled} />
  </div>
</div>
      </div>
    </Chrome>
  );
}
