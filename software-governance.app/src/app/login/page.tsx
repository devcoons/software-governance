// src/app/login/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';

import { sessionStore } from '@/lib/sstore.node';
import LoginForm from '@/components/login_form';
import FooterBar from '@/components/footer';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  const sess = sid ? await sessionStore.getSession(sid) : null;
  if (sess) redirect('/dashboard');

  return (
    <div className="min-h-svh flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <LoginForm />
      </div>
      <FooterBar />
    </div>
  );
}
