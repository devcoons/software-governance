/* ---------------------------------------------------------------------- */
/* Filepath: src/app/api/(protected)/users/delete/route.ts */
/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { withSession } from '@/server/http/with-session'
import { verifyTotpPin } from '@/server/totp/provider'
import { redisStore } from '@/server/auth/redis'
import { hasRoles } from '@/app/_com/utils'
import { deleteUser } from '@/server/db/user-repo'

/* ---------------------------------------------------------------------- */

const Body = z.object({
    userId: z.string().min(1),
    totp: z.string().min(1),
})

/* ---------------------------------------------------------------------- */

export const POST = withSession(async (req: NextRequest, _ctx, session) => {
    if (!hasRoles(session, ['admin'])) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })

    const { userId, totp } = parsed.data
    const totpOk = await verifyTotpPin(session.user_id, totp)
    if (!totpOk.ok) return NextResponse.json({ ok: false, error: 'totp_invalid' }, { status: 401 })

    if (userId === session.user_id) {
        return NextResponse.json({ ok: false, error: 'cannot_delete_self' }, { status: 400 })
    }
    await deleteUser(userId) 
    await Promise.all([
        redisStore.revokeUserSessions(userId),
        redisStore.revokeUserRefresh(userId),
    ])

    return NextResponse.json({ ok: true })
})

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */