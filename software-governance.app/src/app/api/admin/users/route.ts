import { NextRequest, NextResponse } from 'next/server';
import { listAllUsers } from '@/lib/repos/users.repo';
import { requireUsersViewerBlocked } from '@/lib/authz';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const ok = await requireUsersViewerBlocked();
  if (!ok.ok) return NextResponse.json({ error: ok.reason }, { status: ok.reason === 'unauthenticated' ? 401 : 403 });

  const users = await listAllUsers();
  return NextResponse.json({ ok: true, users });
}
