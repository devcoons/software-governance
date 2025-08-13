import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  REFRESH_COOKIE,
  setSessionCookie,
  clearAuthCookies,
  setForcePwdCookie,
} from '@/lib/cookies';
import { sessionStore } from '@/lib/session.node';

export const runtime = 'nodejs';

function safeNext(n?: string | null): string {
  if (!n) return '/dashboard';
  if (!n.startsWith('/') || n.startsWith('//')) return '/dashboard';
  // Never bounce into APIs or internals
  if (n.startsWith('/api') || n.startsWith('/_next') || n.startsWith('/public') || n === '/favicon.ico') {
    return '/dashboard';
  }
  return n;
}

function absoluteUrl(req: NextRequest, path: string): string {
  const base = new URL(req.url).origin;     // e.g., https://example.com
  return new URL(path, base).toString();    // -> absolute URL
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const nextPath = safeNext(url.searchParams.get('next'));
  const nextAbs = absoluteUrl(req, nextPath);

  const jar = await cookies(); // sync
  const sid = jar.get(SESSION_COOKIE)?.value ?? null;

  if (sid) {
    const s = await sessionStore.getSession(sid).catch(() => null);
    if (s) {
      const res = NextResponse.redirect(nextAbs, { status: 303 });
      setForcePwdCookie(res, !!s.claims?.forcePasswordChange);
      return res;
    }
  }

  const rid = jar.get(REFRESH_COOKIE)?.value ?? null;
  if (!rid) {
    const toLogin = absoluteUrl(req, `/login?next=${encodeURIComponent(nextPath)}`);
    const res = NextResponse.redirect(toLogin, { status: 303 });
    clearAuthCookies(res);
    setForcePwdCookie(res, false);
    return res;
  }

  const refresh = await sessionStore.getRefresh(rid).catch(() => null);
  if (!refresh) {
    const toLogin = absoluteUrl(req, `/login?next=${encodeURIComponent(nextPath)}`);
    const res = NextResponse.redirect(toLogin, { status: 303 });
    clearAuthCookies(res);
    setForcePwdCookie(res, false);
    return res;
  }

  // Mint a new short-lived session from the refresh claims
  const newSid = await sessionStore.createSession(refresh.claims);
  const res = NextResponse.redirect(nextAbs, { status: 303 });
  setSessionCookie(res, newSid);
  setForcePwdCookie(res, !!refresh.claims?.forcePasswordChange);
  return res;
}

export async function POST(req: NextRequest) {
  return GET(req);
}