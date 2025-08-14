/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { read as readSession } from '@/server/auth/reader'
import { getTotpInfo, toggleStatus } from '@/server/db/user-repo'
import { hasRoles } from '@/server/auth/ctx'
import { verifyTotpPin } from '@/server/totp/provider'

/* ---------------------------------------------------------------------- */

type Body = { userId: string, totp:string }

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
    const sess = await readSession(req)
    if (!sess) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
    if (!hasRoles(sess,['admin'])) return NextResponse.json({ ok: false, error: 'requires_admin_level' }, { status: 401 })

    let body: Body
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
    }

    const verification = await verifyTotpPin(sess.user_id,body.totp);

    if (!verification) return NextResponse.json({ ok: false, error: 'verification_aborted' }, { status: 400 })
    if (verification.ok)
    {
        const result = toggleStatus(body.userId);
        return NextResponse.json({ ok: true, error: '' })
    }
  return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 400 })

}
