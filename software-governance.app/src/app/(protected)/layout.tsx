/* layout.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { getCurrentSession } from '@/server/auth/ctx';
import { redirect } from 'next/dist/server/api-utils';
import { headers } from 'next/headers';
import { ReactNode } from 'react'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

export default function ProtectedLayout({ children }: { children: ReactNode }) {

    return <>{children}</>
}

/* ---------------------------------------------------------------------- */