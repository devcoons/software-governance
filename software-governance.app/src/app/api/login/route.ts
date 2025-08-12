// src/app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getByEmail } from '@/lib/repos/users.repo';
import { verifyPassword } from '@/lib/crypto';
import { sessionStore } from '@/lib/sstore.node';
import { setSessionCookie, setRefreshCookie, setForcePwdCookie } from '@/lib/cookies';
import { rateLimit } from '@/lib/rate';
import { audit } from '@/lib/repos/audit.repo';

export const runtime = 'nodejs';

// small helper to keep redirects on-site
function safeNext(n?: unknown) {
  const s = typeof n === 'string' ? n : '';
  if (!s) return '/dashboard';
  if (!s.startsWith('/') || s.startsWith('//')) return '/dashboard';
  return s;
}

export async function POST(req: NextRequest) {
  // body may contain { email, password, next? }
  const body = await req.json().catch(() => ({} as any));
  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const next = safeNext(body.next);

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'Missing email/password' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = await rateLimit(`login:${email}:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many attempts' }, { status: 429 });
  }

  const user = await getByEmail(email);
  if (!user) {
    await audit(null, 'login_fail', { reason: 'bad_credentials', email });
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  const ok = await verifyPassword(user.password, password);
  if (!ok) {
    await audit(null, 'login_fail', { reason: 'bad_credentials', email });
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  await audit(user.id, 'login_success', null);

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

  const force = !!user.forcePasswordChange;
  const redirectTo = force ? '/auth/force-change' : next || '/dashboard';

  const res = NextResponse.json({
    ok: true,
    forcePasswordChange: force,
    redirect: redirectTo,
  });

  setSessionCookie(res, sid);
  setRefreshCookie(res, rid);
  setForcePwdCookie(res, force); // <-- drives the middleware gate

  return res;
}
