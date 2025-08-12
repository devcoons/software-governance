// src/app/approvals/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/cookies';
import { sessionStore } from '@/lib/sstore.node';
import Chrome from '@/components/chrome';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NEXT_PATH = '/approvals'; // keep explicit to avoid sending users to /dashboard accidentally

export default async function ApprovalsPage() {
  // 1) Read cookie (sync)
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid) {
    redirect(`/api/session/refresh?next=${encodeURIComponent(NEXT_PATH)}`);
  }

  // 2) Lightweight server-side presence check (no claims parsing here)
  const sess = await sessionStore.getSession(sid);
  if (!sess) {
    redirect(`/api/session/refresh?next=${encodeURIComponent(NEXT_PATH)}`);
  }

  // Optional: you can read claims if you need RBAC here
  // const { claims } = sess;

  return (
    <Chrome>
      <div className="max-w-screen-xl mx-auto px-4 lg:px-16 py-6">
        <div className="max-w-3xl">
          <p className="text-sm text-gray-600 mb-6">Approvals</p>
        </div>
      </div>
    </Chrome>
  );
}
