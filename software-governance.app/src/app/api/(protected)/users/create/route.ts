/* ---------------------------------------------------------------------- */
/* Filepath: src/app/api/(protected)/users/create/route.ts */
/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ---------------------------------------------------------------------- */

import { z } from 'zod'
import { hasRoles } from '@/app/_com/utils'
import { NextRequest, NextResponse } from 'next/server'
import { withSession } from '@/server/http/with-session'
import { createAuditLog, createUserWithTempPassword } from '@/server/db/mysql-queries.insert'

/* ---------------------------------------------------------------------- */

const Body = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'user', 'viewer']),
})

/* ---------------------------------------------------------------------- */

export const POST = withSession(async (req: NextRequest, _ctx, session) => {
    if (!hasRoles(session, ['admin'])) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) 
    {
        await createAuditLog(session.user_id,'user:create',{'status':'error:invalid_payload'})
        return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
    }
    const { email, role } = parsed.data
    const { tempPassword } = await createUserWithTempPassword(email, [role])
    
    await createAuditLog(session.user_id,'user:create',{'email':email,'role':role,'status':'ok'})

    return NextResponse.json({ ok: true, password: tempPassword }, { headers: { 'Cache-Control': 'no-store' } })
})

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */