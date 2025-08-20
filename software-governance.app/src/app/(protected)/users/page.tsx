
import { listAllUsers } from '@/server/db/user-repo'

import Chrome from '@/app/_com/chrome';
import UsersTableAdmin from './_com/users-table-admin';
import UsersTable from './_com/users-table';
import { getSessionOrBridge } from '@/server/auth/ctx';
import { redirect } from 'next/navigation';
import { hasRoles, toSessionView } from '@/app/_com/utils';
import { listAllUusersVisual } from '@/server/db/user-profile-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function UsersOverviewPage() {
    
    const session = await getSessionOrBridge(); 
    const sessionView = toSessionView(session);

    if(!hasRoles(session,['admin','user']))
        return redirect('/dashboard');


  const isAdmin = hasRoles(session,['admin'])
  
  return (
    <Chrome session={sessionView}>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-16 py-8">
        <h1 className="text-2xl font-bold mb-6">Users</h1>
        <div className="card bg-base-100 shadow-md border border-base-300">
            {isAdmin 
            ? 
                (<UsersTableAdmin users={await listAllUsers()}/>)
            :
                (<UsersTable users={ await listAllUusersVisual()}/>)
            }
        </div>
      </div>
    </Chrome>
  );
}
