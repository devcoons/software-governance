import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';

import { sessionStore } from '@/lib/sstore.node';
import Chrome from '@/components/chrome';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PendingPage() {
  const currentPath = (await headers()).get('x-invoke-path') || '/dashboard';
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid) {
    redirect(`/api/session/refresh?next=${encodeURIComponent(currentPath)}`);
  }
  const sess = await sessionStore.getSession(sid);
  if (!sess) {
    redirect(`/api/session/refresh?next=${encodeURIComponent(currentPath)}`);
  }

  const { claims } = sess;

  return (
     <Chrome>
      <div className="max-w-screen-xl mx-auto px-4 lg:px-16 py-6">
    <div className="max-w-3xl">
       
        <p className="text-sm text-gray-600 mb-6">List of software</p>

      </div>
      </div>
      </Chrome>
  );
}
