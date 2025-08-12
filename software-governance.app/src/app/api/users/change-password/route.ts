import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';

import { sessionStore } from '@/lib/sstore.node';
import { getById, updatePasswordAndClearForce, insertAudit } from '@/lib/repos/users.repo';
import { verifyPassword, hashPassword } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate';

export const runtime = 'nodejs';

function validateNewPassword(pw: string) {
  // minimal: length >= 8; extend with entropy rules if you want
  return typeof pw === 'string' && pw.length >= 8;
}

export async function POST(req: NextRequest) {
  // Rate-limit (per-session): 5 attempts / 5 minutes
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await sessionStore.getSession(sid);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.claims.sub;

  const rl = await rateLimit(`pwchange:${userId}`, 5, 300);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts, try later.' }, { status: 429 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { currentPassword, newPassword } = body || {};
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!validateNewPassword(newPassword)) {
    return NextResponse.json({ error: 'Password too weak (min 8 chars).' }, { status: 400 });
  }

  const user = await getById(userId);
  if (!user) {
    await insertAudit(userId, 'password_change_fail', { reason: 'user_not_found' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ok = await verifyPassword(user.password, currentPassword);
  if (!ok) {
    await insertAudit(userId, 'password_change_fail', { reason: 'bad_current' });
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
    await insertAudit(userId, 'password_change_fail', { reason: 'update_failed' });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  await insertAudit(userId, 'password_change_success', null);

  // Optional: revoke all other sessions for this user (keep current)
  // await sessionStore.revokeAllForUser(userId);

  return NextResponse.json({ ok: true });
}
