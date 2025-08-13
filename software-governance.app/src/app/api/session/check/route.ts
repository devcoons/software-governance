// src/app/api/session/check/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/cookies';
import { sessionStore } from '@/lib/session.node';

export const runtime = 'nodejs';

export async function GET() {
  // cookies() is sync in node runtime; await is harmless but unnecessary
  const sid = (await cookies()).get(SESSION_COOKIE)?.value || null;
  if (!sid) return NextResponse.json({ ok: false });

  const sess = await sessionStore.getSession(sid).catch(() => null);
  if (!sess?.claims) return NextResponse.json({ ok: false });

  // Return only what the client needs for UI
  const { sub, email, roles = [] } = sess.claims as {
    sub?: string;
    email?: string;
    roles?: string[];
  };

  return NextResponse.json({
    ok: true,
    user: { id: sub ?? null, email: email ?? null },
    roles,
    claims: { roles }, // keep a compat field if your UI reads claims.roles
  });
}
