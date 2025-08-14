// src/app/users/register/page.tsx
import { redirect } from 'next/navigation';

import RegisterForm from './_com/u-register-form';
import Chrome from '@/app/_com/chrome';
import { getSession } from '@/server/auth/ctx';

export const runtime = 'nodejs';

export default async function RegisterUserPage() {
  const sess = await getSession()
  const auth = await requireRole(['admin']);
  if (!auth.ok) redirect('/users');

  return (
    <Chrome>
      <div className="max-w-screen-xl mx-auto px-4 lg:px-16 py-8">
        <h1 className="text-2xl font-bold mb-6">Register New User</h1>
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Left column: form */}
          <section className="lg:col-span-2">
            <div className="card bg-base-100 shadow-md border border-base-300 self-start">
              <div className="card-body">
               
                <p className="text-sm opacity-70 mb-2">
                  Create an account and assign an initial role.
                </p>
              
                <RegisterForm />
              </div>
            </div>
          </section>

        {/* Right column: guidance */}
        <aside className="space-y-6">
          <div className="card bg-base-100 shadow-md border border-base-300 self-start">
            <div className="card-body">
              <h2 className="card-title">Roles</h2>
              <ul className="list-disc list-inside text-sm leading-6">
                <li><b>Admin</b>: full access, manage users & roles.</li>
                <li><b>User</b>: standard access (can view users list).</li>
                <li><b>Viewer</b>: read-only; no access to Users section.</li>
              </ul>
            </div>
          </div>

          <div className="card bg-base-100 shadow-md border border-base-300 self-start">
            <div className="card-body">
              <h2 className="card-title">Password policy</h2>
              <p className="text-sm opacity-80">
                The system generates a strong temporary password; the user must change it on first login.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-md border border-base-300 self-start">
            <div className="card-body">
              <h2 className="card-title">Security note</h2>
              <p className="text-sm opacity-80">
                Temporary passwords are displayed once and not stored in logs. Share via a secure channel.
              </p>
            </div>
          </div>
        </aside>
      </div>
      </div>
    </Chrome>
  );
}
