import 'server-only';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/cookies';
import { sessionStore, type Claims, type SessionRec } from '@/lib/session.node';
import { getUserById } from '@/lib/repos/n_users.repo';

export type AuthContext = {
  sessionId: string;
  session: SessionRec;
  claims: Claims;
};

// Avoid redirect loops by never using these as "next"
const FORBIDDEN_NEXT = new Set<string>([
  '/login',
  '/api/session/refresh',
  '/maintenance',
]);

/**
 * Resolve where to go back AFTER refreshing the session.
 * Prefer an explicit nextPath from the caller.
 * Otherwise try to infer from headers; if not available, fall back to '/'.
 */
async function  resolveNextPath(explicit?: string): Promise<string> {
  if (explicit && !FORBIDDEN_NEXT.has(explicit)) return explicit;

  const h = await headers(); // sync
  const cand =
    h.get('x-invoke-path') ||
    h.get('x-original-url') ||
    h.get('x-pathname') ||
    // last resort: try to parse referer path (may be previous page)
    (() => {
      const ref = h.get('referer');
      try {
        if (!ref) return null;
        const u = new URL(ref);
        return u.pathname || null;
      } catch {
        return null;
      }
    })() ||
    '/';

  return FORBIDDEN_NEXT.has(cand) ? '/' : cand;
}

function redirectToRefresh(nextPath: string): never {
  // Avoid pointing refresh to itself or login
  const next = FORBIDDEN_NEXT.has(nextPath) ? '/' : nextPath;
  redirect(`/api/session/refresh?next=${encodeURIComponent(next)}`);
}

/**
 * Require a valid session. If missing/invalid, redirect to refresh with a sane "next".
 * @param nextPath   Strongly recommend passing the current route path (e.g., '/users').
 * @param checkFromDB If true, revalidate the user exists in DB; if not, redirect to refresh.
 */
export async function requireAuth(nextPath?: string, checkFromDB: boolean = false): Promise<AuthContext> {
  const next = await resolveNextPath(nextPath);

  // Read cookie
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid) redirectToRefresh(next);

  // Fetch session (treat errors as missing session)
  let session: SessionRec | null = null;
  try {
    session = await sessionStore.getSession(sid);
  } catch {
    session = null;
  }
  if (!session) redirectToRefresh(next);

  if (checkFromDB) {
    try {
      const user = await getUserById(session.claims.userId);
      if (!user) redirectToRefresh(next);
    } catch {
      // DB error – act as if user not found
      redirectToRefresh(next);
    }
  }

  return { sessionId: sid, session, claims: session.claims };
}
