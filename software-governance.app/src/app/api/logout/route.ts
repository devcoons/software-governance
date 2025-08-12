import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, REFRESH_COOKIE, clearAuthCookies } from '@/lib/cookies';
import { sessionStore } from '@/lib/sstore.node';
import { setForcePwdCookie } from '@/lib/cookies';

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

function safePath(p?: string | null) {
  if (!p) return '/login';
  if (!p.startsWith('/') || p.startsWith('//')) return '/login';
  return p;
}

export async function POST(_req: NextRequest) {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  const rid = jar.get(REFRESH_COOKIE)?.value;

  // clear cookies immediately so the client is logged out even if Redis is slow
 const url = new URL(_req.url);
 const next = safePath(url.searchParams.get('next'));

  // Clear cookies immediately; avoid method replay with 303
  const res = NextResponse.redirect(new URL(next, url.origin), 303);
  clearAuthCookies(res);
  setForcePwdCookie(res, false);

  // Best-effort revoke in background
  revokeSafely(sid, rid).catch(() => {});

  return res;
}

// optional: support GET for manual testing
export async function GET(req: NextRequest) {
  return POST(req);
}
