/* ---------------------------------------------------------------------- */
/* Filepath: /src/app/api/(protected)/me/totp/verify/route.ts */
/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { withSession } from '@/server/http/with-session'
import { getTotpInfo } from '@/server/db/mysql-queries.select'

/* ---------------------------------------------------------------------- */

export const GET = withSession(async (req: NextRequest, _ctx, session) => {
    const result = await getTotpInfo(session.user_id)
    return NextResponse.json({ ok: true, enabled: result.enabled }, { headers: { 'Cache-Control': 'no-store' } })
})

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
