// src/app/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  REFRESH_COOKIE,
  setSessionCookie,
  clearAuthCookies,
  setForcePwdCookie,
} from '@/lib/cookies';
import { sessionStore } from '@/lib/sstore.node';

export const runtime = 'nodejs';

function safeNext(n?: string | null) {
  if (!n) return '/dashboard';
  if (!n.startsWith('/') || n.startsWith('//')) return '/dashboard';
  return n;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get('next'));

  const jar = await cookies(); // ← no await
  const sid = jar.get(SESSION_COOKIE)?.value ?? null;
  if (sid) {
    const s = await sessionStore.getSession(sid).catch(() => null);
    if (s) {
      // keep fp cookie in sync with claims if present
      const res = NextResponse.redirect(next);
      setForcePwdCookie(res, !!s.claims?.forcePasswordChange);
      return res;
    }
  }

  const rid = jar.get(REFRESH_COOKIE)?.value ?? null;
  if (!rid) {
    const res = NextResponse.redirect(`/login?next=${encodeURIComponent(next)}`);
    clearAuthCookies(res);
    setForcePwdCookie(res, false);
    return res;
  }

  const refresh = await sessionStore.getRefresh(rid).catch(() => null);
  if (!refresh) {
    const res = NextResponse.redirect(`/login?next=${encodeURIComponent(next)}`);
    clearAuthCookies(res);
    setForcePwdCookie(res, false);
    return res;
  }

  // Mint a new short-lived session from the refresh claims
  const newSid = await sessionStore.createSession(refresh.claims);
  const res = NextResponse.redirect(next);
  setSessionCookie(res, newSid);
  // mirror the force-password flag into the fp cookie for middleware
  setForcePwdCookie(res, !!refresh.claims?.forcePasswordChange);
  return res;
}

export async function POST(req: NextRequest) {
  return GET(req);
}
