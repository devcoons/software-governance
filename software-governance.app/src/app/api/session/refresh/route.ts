// src/app/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';

import { sessionStore } from '@/lib/sstore.node';
import { setSessionCookie, clearAuthCookies } from '@/lib/cookies';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') || '/dashboard';

  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) {
    const s = await sessionStore.getSession(sid);
    if (s) return NextResponse.redirect(next);
  }

  const rid = jar.get(REFRESH_COOKIE)?.value;
  if (!rid) {
    const res = NextResponse.redirect('/login');
    clearAuthCookies(res);
    return res;
  }

  const refresh = await sessionStore.getRefresh(rid);
  if (!refresh) {
    const res = NextResponse.redirect('/login');
    clearAuthCookies(res);
    return res;
  }

  // Mint a new short-lived session off the refresh claims
  const newSid = await sessionStore.createSession(refresh.claims);
  const res = NextResponse.redirect(next);
  setSessionCookie(res, newSid);
  return res;
}
