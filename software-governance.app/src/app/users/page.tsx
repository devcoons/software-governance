// app/users/page.tsx (or the route you showed)
import Chrome from '@/components/chrome';
import Link from 'next/link';
import { listAllUsers } from '@/lib/repos/users.repo';
import { requireUsersViewerBlocked } from '@/lib/authz';
import UsersTable from '@/app/users/_client/UsersTable'; // NEW

export const runtime = 'nodejs';

export default async function UsersOverviewPage() {
  const auth = await requireUsersViewerBlocked();
  if (!auth.ok) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-semibold mb-2">Access denied</h1>
        <p className="opacity-70">You don’t have access to Users.</p>
      </main>
    );
  }

  const isAdmin = (auth.claims.roles || []).includes('admin');
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
