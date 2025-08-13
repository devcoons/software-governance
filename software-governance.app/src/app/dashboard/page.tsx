import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';
import { requireAuth } from '@/lib/auth/require-auth';
import { sessionStore } from '@/lib/session.node';
import Chrome from '@/components/chrome';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const currentPath = (await headers()).get('x-invoke-path') || '/dashboard';
  
  const { claims } = await requireAuth();

  if(!claims) 
    return redirect('/login');


  return (
     <Chrome>
      <div className="max-w-screen-xl mx-auto px-4 lg:px-16 py-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
        <p className="text-sm text-gray-600 mb-6">Welcome, {claims.email}</p>

        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="text-sm">
            <div><span className="font-medium">User ID:</span> {claims.userId}</div>
            <div className="mt-1"><span className="font-medium">Roles:</span> {claims.roles?.join(', ') || '(none)'}</div>
            <div className="mt-1"><span className="font-medium">Permissions:</span> {claims.permissions?.join(', ') || '(none)'}</div>
            {claims.forcePasswordChange ? (
              <div className="mt-3 rounded-lg bg-yellow-50 px-3 py-2 text-yellow-800">
                You must change your password.
              </div>
            ) : null}
          </div>

          <form
            className="mt-6"
            action="/api/logout"
            method="post"
          >
            <button
              className="btn"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
      </div>
      </Chrome>
  );
}
