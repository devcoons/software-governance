
// app/users/page.tsx (or the route you showed)

import { listAllUsers } from '@/server/db/user-repo'

import Chrome from '@/app/_com/chrome';
import UsersTable from './_com/users-table';
import { getSession, hasRoles } from '@/server/auth/ctx';
import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function UsersOverviewPage() {
    const sess = await getSession()
    
    if(!hasRoles(sess,['admin','user']))
      return redirect('/dashboard');


  const isAdmin = hasRoles(sess,['admin'])
  const users = await listAllUsers(); // return [{ id, email, roles, totpEnabled, forcePasswordChange, createdAt }, ...]

  return (
    <Chrome>
      <div className="max-w-screen-xl mx-auto px-4 lg:px-16 py-8">
        <h1 className="text-2xl font-bold mb-6">Users</h1>
        <div className="card bg-base-100 shadow-md border border-base-300">
          <UsersTable users={users} isAdmin={isAdmin} />
        </div>
      </div>
    </Chrome>
  );
}
