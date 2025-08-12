import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { setPassword } from '@/lib/repos/users.repo';
import { generateTempPassword, hashPassword } from '@/lib/crypto';
import { audit } from '@/lib/repos/audit.repo';
import { sessionStore } from '@/lib/sstore.node';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason === 'unauthenticated' ? 401 : 403 });

  const userId = params.id;
  const temp = generateTempPassword();
  const hash = await hashPassword(temp);

  // forcePasswordChange=true via existing helper
  await setPassword(userId, hash, { forceChange: true } as any);

  // revoke all sessions for that user
  await sessionStore.revokeAllForUser(userId).catch(() => {});
  await audit(auth.claims.userId ?? null, 'user_reset_password', { target: userId });

  return NextResponse.json({ ok: true, tempPassword: temp });
}
