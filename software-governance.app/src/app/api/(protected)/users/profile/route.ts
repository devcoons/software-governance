/* ---------------------------------------------------------------------- */
// app/api/admin/users/route.ts
/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ---------------------------------------------------------------------- */

import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { withSession } from '@/server/http/with-session'
import { getUserProfileById } from '@/server/db/user-profile-repo'

/* ---------------------------------------------------------------------- */

export const GET = withSession(async (req: NextRequest, _ctx, session) => {

    const url = new URL(req.url)
    const qs = Object.fromEntries(url.searchParams.entries())
    console.log("----")
    const QSchema = z.object({
        userId: z.string()
    })
    
    let query: z.infer<typeof QSchema>
    try {
        query = QSchema.parse(qs)
    } catch {
        return NextResponse.json({ ok: false, error: 'bad_payload' }, { status: 400 })
    }

    const profile = await getUserProfileById(query.userId)
    return NextResponse.json({ ok: true, data: profile})
})

/* ---------------------------------------------------------------------- */
