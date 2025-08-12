import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, REFRESH_COOKIE, clearAuthCookies } from '@/lib/cookies';
import { sessionStore } from '@/lib/sstore.node';

function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

async function revokeSafely(sessionId?: string, refreshId?: string) {
  const tasks: Promise<unknown>[] = [];
  if (sessionId) tasks.push(withTimeout(sessionStore.revokeSession(sessionId), 1500));
  if (refreshId) tasks.push(withTimeout(sessionStore.revokeRefresh(refreshId), 1500));
  await Promise.allSettled(tasks);
}

export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  const rid = jar.get(REFRESH_COOKIE)?.value;

  // clear cookies immediately so the client is logged out even if Redis is slow
  const res = NextResponse.redirect(new URL('/login', _req.url));
  clearAuthCookies(res);

  // revoke in the background; do not block the response
  revokeSafely(sid, rid).catch(() => {});

  return res;
}

// optional: support GET for manual testing
export async function GET(req: NextRequest) {
  return POST(req);
}
