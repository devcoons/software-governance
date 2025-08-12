/* ------------------------------------------------------- */
/* ------------------------------------------------------- */
/* ------------------------------------------------------- */

import Chrome               from '@/components/chrome';
import { requireAuth }      from '@/lib/auth/require-auth';
import { cookies, headers } from 'next/headers';
import { redirect }         from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ------------------------------------------------------- */
/* ------------------------------------------------------- */
/* ------------------------------------------------------- */

export default async function Page() 
{
  const { claims } = await requireAuth();


  /* ------------------------------------------------------- */
  /* ------------------------------------------------------- */

  return (
    <Chrome>
    <div className="max-w-screen-xl mx-auto px-4 lg:px-16 py-6">
      <div className="max-w-3xl">
        <p className="text-sm text-gray-600 mb-6">Pending Software Approvals</p>
      </div>
    </div>
    </Chrome>
  );
}
