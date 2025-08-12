// src/app/api/users/me/force-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sessionStore } from '@/lib/sstore.node';
import { getById, updatePasswordAndClearForce } from '@/lib/repos/users.repo';
import { audit } from '@/lib/repos/audit.repo';
import { verifyPassword, hashPassword } from '@/lib/crypto'; // <- reuse your helpers
import {
  SESSION_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setForcePwdCookie,
} from '@/lib/cookies';

export const runtime = 'nodejs';

type Body = { currentPassword?: string; newPassword?: string };

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: NextRequest) {
  // 1) Parse & validate body
  const body = (await req.json().catch(() => ({}))) as Body;
  const currentPassword = body.currentPassword?.trim() ?? '';
  const newPassword = body.newPassword?.trim() ?? '';
  if (!currentPassword || !newPassword) return bad('Missing fields');
  if (newPassword.length < 10) return bad('New password too short (min 10 chars)');
  if (newPassword === currentPassword) return bad('New password must be different');

  // 2) Session required (middleware should allow this route even when forced)
  const sid = req.cookies.get(SESSION_COOKIE)?.value ?? null;
  if (!sid) return bad('Not authenticated', 401);
  const sess = await sessionStore.getSession(sid).catch(() => null);
  if (!sess?.claims?.sub) return bad('Session expired', 401);
  const userId = sess.claims.sub;

  // 3) Load user & check that force flag is on (defensive)
  const user = await getById(userId);
  if (!user) return bad('User not found', 404);
  if (!user.forcePasswordChange) return bad('Password change is not required', 409);

  // 4) Verify current password using SAME util as login
  const ok = await verifyPassword(user.password, currentPassword);
  if (!ok) {
    await audit(userId, 'password_change_fail', { reason: 'bad_current' }).catch(() => {});
    return bad('Current password is incorrect');
  }

  // 5) Hash & update (and clear DB force flag)
  const newHash = await hashPassword(newPassword);
  const changed = await updatePasswordAndClearForce(userId, newHash);
  if (!changed) return bad('Failed to update password', 500);

  await audit(userId, 'password_change_success', { forced: true }).catch(() => {});

  // 6) Revoke ALL sessions/refresh for safety (don’t block if Redis is slow)
  await sessionStore.revokeAllForUser(userId).catch(() => {});

  // 7) Clear auth cookies + force flag cookie; tell client to go to /login
  const res = NextResponse.json({ ok: true, redirect: '/login' });
  clearAuthCookies(res);
  setForcePwdCookie(res, false);
  return res;
}

// Optional: block GET so you don't accidentally call it in the browser
export async function GET() {
  return NextResponse.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}
