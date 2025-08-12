import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/cookies';
import { sessionStore } from '@/lib/sstore.node';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  if (!sid) return NextResponse.json({ ok: false }, { status: 200 });

  const sess = await sessionStore.getSession(sid).catch(() => null);
  if (!sess) return NextResponse.json({ ok: false }, { status: 200 });

  return NextResponse.json({
    ok: true,
    forcePasswordChange: !!sess.claims?.forcePasswordChange,
  });
}
