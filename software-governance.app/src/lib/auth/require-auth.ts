import 'server-only';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/auth.config'; 
import { sessionStore, type Claims, type SessionRec } from '@/lib/sstore.node';
import { getUserById } from '@/lib/repos/n_users.repo';

export type AuthContext = {
  sessionId: string;
  session: SessionRec;      
  claims: Claims;
};

async function resolveNextPath(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const h = await headers();
  return (
    h.get('x-invoke-path') ||
    h.get('x-original-url') ||
    h.get('x-pathname') ||
    '/dashboard'
  );
}

function redirectToRefresh(nextPath: string): never {
  redirect(`/api/session/refresh?next=${encodeURIComponent(nextPath)}`);
}

export async function requireAuth(nextPath?: string, checkFromDB?: boolean | false): Promise<AuthContext> 
{
  const next = await resolveNextPath(nextPath);
  
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid) redirectToRefresh(next);
  const session = await sessionStore.getSession(sid!);
  if (!session) redirectToRefresh(next);
  if(checkFromDB){
    const user = await getUserById(session.claims.userId);
    if (!user) redirectToRefresh(next);
  }
  return { sessionId: sid!, session, claims: session.claims };
}

