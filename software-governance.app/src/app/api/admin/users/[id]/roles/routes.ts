import { NextRequest, NextResponse } from 'next/server';
import { requireRole, normalizeSingleRole } from '@/lib/authz';
import { updateRoles } from '@/lib/repos/users.repo';
import { audit } from '@/lib/repos/audit.repo';
import { sessionStore } from '@/lib/sstore.node';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason === 'unauthenticated' ? 401 : 403 });

  const { role } = await req.json().catch(() => ({}));
  let normalized: 'admin'|'user'|'viewer';
  try { normalized = await normalizeSingleRole(role); } catch { return NextResponse.json({ error: 'Invalid role' }, { status: 400 }); }

  await updateRoles(params.id, [normalized]);
  await sessionStore.revokeAllForUser(params.id).catch(() => {}); // force re-login to pick new roles
  await audit(auth.claims.userId ?? null, 'user_update_role', { target: params.id, role: normalized });

  return NextResponse.json({ ok: true });
}
