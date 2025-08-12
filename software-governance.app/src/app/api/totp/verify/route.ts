// src/app/api/totp/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/cookies';
import { sessionStore } from '@/lib/sstore.node';
import { getById, insertAudit } from '@/lib/repos/users.repo';
import { getTotpByUser } from '@/lib/repos/totp.repo';
import { authenticator } from '@/lib/totp';
import { rateLimit } from '@/lib/rate';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sess = await sessionStore.getSession(sid);
  if (!sess) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const userId = sess.claims.sub;

  // rate limit: 6 verify attempts / 5 minutes per user
  const rl = await rateLimit(`totp:verify:${userId}`, 6, 300);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: 'Too many attempts, try later.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }
  const code = String(body?.code || '').trim();

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, message: 'Code must be 6 digits.' }, { status: 400 });
  }

  const user = await getById(userId);
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!user.totpEnabled) {
    await insertAudit(userId, 'totp_verify_fail', { reason: 'not_enabled' });
    return NextResponse.json({ ok: false, message: 'TOTP not enabled yet' }, { status: 400 });
  }

  const rec = await getTotpByUser(userId);
  if (!rec) {
    await insertAudit(userId, 'totp_verify_fail', { reason: 'no_secret' });
    return NextResponse.json({ ok: false, message: 'TOTP not enabled yet' }, { status: 400 });
  }

  const isValid = authenticator.verify({ token: code, secret: rec.secret_b32 });
  if (!isValid) {
    await insertAudit(userId, 'totp_verify_fail', { reason: 'bad_token' });
    return NextResponse.json({ ok: false, message: 'Invalid code' }, { status: 400 });
  }

  await insertAudit(userId, 'totp_verify_success', null);
  return NextResponse.json({ ok: true, message: 'Verified' });
}
