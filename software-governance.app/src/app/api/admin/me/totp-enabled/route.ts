// app/api/admin/me/totp-enabled/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz'; // replace with your real admin check

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    enabled: !!admin.totpEnabled,
  });
}
