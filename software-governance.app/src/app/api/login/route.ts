// src/app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getByEmail } from '@/lib/repos/users.repo';
import { verifyPassword } from '@/lib/crypto';
import { sessionStore } from '@/lib/sstore.node';
import { setSessionCookie, setRefreshCookie } from '@/lib/cookies';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email/password' }, { status: 400 });
  }

  const user = await getByEmail(email);
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const ok = await verifyPassword(user.password, password);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  // build claims (preserve your shape)
  const claims = {
    sub: user.id,
    email: user.email,
    roles: user.roles || [],
    permissions: user.permissions || [],
    totp_enabled: user.totpEnabled ?? false,
    forcePasswordChange: user.forcePasswordChange ?? false,
  };

  const [sid, rid] = await Promise.all([
    sessionStore.createSession(claims as any),
    sessionStore.createRefresh(claims as any),
  ]);

  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, sid);
  setRefreshCookie(res, rid);
  return res;
}
