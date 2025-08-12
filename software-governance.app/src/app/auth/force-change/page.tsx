import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/cookies';
import { readSessionQuick } from '@/lib/sstore.node';
import ForcePasswordForm from '@/app/auth/force-change/ForcePasswordForm'

export const runtime = 'nodejs';

export default async function ForceChangePage() {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value || null;
  if (!sid) redirect('/login');

  const sess = await readSessionQuick(sid);
  if (!sess?.claims?.forcePasswordChange) redirect('/dashboard');

  return (
    <main className="min-h-screen w-full grid place-items-center bg-base-200">
      <div className="w-full max-w-md">
        <ForcePasswordForm />
      </div>
    </main>
  );
}
