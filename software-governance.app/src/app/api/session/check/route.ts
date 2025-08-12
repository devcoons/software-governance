// src/app/api/session/check/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';

import { sessionStore } from '@/lib/sstore.node';

export const runtime = 'nodejs';

export async function GET() {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid) return NextResponse.json({ ok: false });

  const sess = await sessionStore.getSession(sid);
  return NextResponse.json({ ok: !!sess });
}
