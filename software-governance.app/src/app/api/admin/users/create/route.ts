import { NextRequest, NextResponse } from 'next/server';
import { requireRole, normalizeSingleRole } from '@/lib/authz';
import { create } from '@/lib/repos/users.repo';
import { generateTempPassword, hashPassword } from '@/lib/crypto';
import { audit } from '@/lib/repos/audit.repo';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
const auth = await requireRole(['admin']);

  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason === 'unauthenticated' ? 401 : 403 });

  const { email, role } = await req.json().catch(() => ({}));
  if (!email || !role) return NextResponse.json({ error: 'Missing email/role' }, { status: 400 });

  let normalized: 'admin'|'user'|'viewer';
  try { normalized = await normalizeSingleRole(role); } catch { return NextResponse.json({ error: 'Invalid role' }, { status: 400 }); }

  const temp = generateTempPassword();
  const hash = await hashPassword(temp);
  const id = await create(String(email), hash, [normalized], []);

  await audit(auth.claims.userId ?? null, 'user_create', { target: id, role: normalized, email });

  // Return temp password ONCE
  return NextResponse.json({ ok: true, id:id, email: String(email), role: normalized, tempPassword: temp });
}
