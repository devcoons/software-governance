/* ---------------------------------------------------------------------- */
/* Filepath: /src/app/api/(protected)/me/totp/verify/route.ts */
/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { withSession } from '@/server/http/with-session'
import { z } from 'zod'
import { verifyTotpPin } from '@/server/totp/provider'
import { redisStore } from '@/server/auth/redis'

/* ---------------------------------------------------------------------- */

const Body = z.object({ code: z.string().trim().min(1) })

/* ---------------------------------------------------------------------- */

export const POST = withSession(async (req: NextRequest, _ctx, session) => {
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) 
        return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })

    const result = await verifyTotpPin(session.user_id, parsed.data.code)
    if (!result.ok) {
        const status = result.error === 'invalid_code' ? 400 : 400
        return NextResponse.json({ ok: false, error: result.error }, { status })
    }

    const nextClaims = { ...session.claims, totp_enabled: true }
    await redisStore.putSession({ ...session, claims: nextClaims })

    return NextResponse.json({ ok: true, enabled: true }, { headers: { 'Cache-Control': 'no-store' } })
})

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
