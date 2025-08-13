// src/app/login/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';

import { sessionStore } from '@/lib/session.node';
import LoginForm from '@/components/login_form';
import FooterBar from '@/components/footer';
import { requireAuth } from '@/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const { claims } = await requireAuth();
  
  if(claims) 
    return redirect('/dashboard');

  return (
    <div className="min-h-svh flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <LoginForm />
      </div>
      <FooterBar />
    </div>
  );
}
