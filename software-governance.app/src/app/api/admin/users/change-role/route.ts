// app/api/admin/users/change-role/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/authz';
import { verifyTotpForUser } from '@/lib/totp';
import * as usersRepo from '@/lib/repos/users.repo';

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(['admin', 'user', 'viewer']),
  totp: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  if (!admin.totpEnabled) {
    return NextResponse.json({ ok: false, error: 'TOTP not enabled' }, { status: 400 });
  }

  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  const { userId, role, totp } = body.data;
  if (!(await verifyTotpForUser(admin.id, totp))) {
    return NextResponse.json({ ok: false, error: 'Invalid TOTP' }, { status: 401 });
  }

  await usersRepo.setRole(userId, role);
  return NextResponse.json({ ok: true });
}
