/* ---------------------------------------------------------------------- */
/* Filepath: src/app/api/(public)/health/route.ts */
/* ---------------------------------------------------------------------- */

import { NextResponse } from 'next/server'
import { getHealth } from '@/server/health/probe'

/* ---------------------------------------------------------------------- */

export async function GET() {
    const h = await getHealth()
    const status = h.ok ? 200 : 503
    return NextResponse.json(h, { status })
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
