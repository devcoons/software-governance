// app/api/me/totp/verify/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { z } from 'zod'
import { getTotpInfo } from '@/server/db/user-repo'
import { NextRequest, NextResponse } from 'next/server'
import { withSession } from '@/server/http/with-session'

export const GET = withSession(async (req: NextRequest, _ctx, session) => {
    const result = await getTotpInfo(session.user_id)
    return NextResponse.json({ ok: true, enabled: result.enabled }, { headers: { 'Cache-Control': 'no-store' } })
})
