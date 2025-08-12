import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';

import { sessionStore } from '@/lib/sstore.node';
import { getById, updatePasswordAndClearForce } from '@/lib/repos/users.repo';
import { audit } from '@/lib/repos/audit.repo';
import { verifyPassword, hashPassword, validatePasswordStrength } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Rate-limit (per-session): 5 attempts / 5 minutes
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await sessionStore.getSession(sid);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.claims.userId;

  const rl = await rateLimit(`pwchange:${userId}`, 5, 300);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts, try later.' }, { status: 429 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { currentPassword, newPassword } = body || {};
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!validatePasswordStrength(newPassword)) {
    return NextResponse.json({ error: 'Password too weak (min 8 chars).' }, { status: 400 });
  }

  const user = await getById(userId);
  if (!user) {
    await audit(userId, 'password_change_fail', { reason: 'user_not_found' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ok = await verifyPassword(user.password, currentPassword);
  if (!ok) {
    await audit(userId, 'password_change_fail', { reason: 'bad_current' });
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  }
  // prevent no-op password
  const same = await verifyPassword(user.password, newPassword);
  if (same) {
    return NextResponse.json({ error: 'New password must differ from current' }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);
  const changed = await updatePasswordAndClearForce(userId, newHash);
  if (!changed) {
    await audit(userId, 'password_change_fail', { reason: 'update_failed' });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  await audit(userId, 'password_change_success', null);

  // Optional: revoke all other sessions for this user (keep current)
  // await sessionStore.revokeAllForUser(userId);

  return NextResponse.json({ ok: true });
}
