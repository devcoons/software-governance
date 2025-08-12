// src/app/api/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';

import { sessionStore } from '@/lib/sstore.node';
import { clearAuthCookies } from '@/lib/cookies';

export const runtime = 'nodejs';

export async function POST() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  const rid = jar.get(REFRESH_COOKIE)?.value;

  if (sid) await sessionStore.revokeSession(sid);
  if (rid) await sessionStore.revokeRefresh(rid);

  const res = NextResponse.redirect('/login');
  clearAuthCookies(res);
  return res;
}
