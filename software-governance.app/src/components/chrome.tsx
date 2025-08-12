// src/components/chrome.tsx
import { cookies } from 'next/headers';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';

import { sessionStore } from '@/lib/sstore.node';
import NavBar from '@/components/navbar';
import FooterBar from '@/components/footer';

export default async function Chrome({ children }: { children: React.ReactNode }) {
  let sess: any = null;

  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (sid) {
      sess = await sessionStore.getSession(sid);
    }
  } catch (err) {
    console.error('Chrome: failed to fetch session', err);
  }

  return (
    <div className="min-h-svh flex flex-col">
      {sess ? <NavBar /> : null}
      <main className="flex-1">{children}</main>
      <FooterBar />
    </div>
  );
}
