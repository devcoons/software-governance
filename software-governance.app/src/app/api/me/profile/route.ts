/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { read as readSession } from '@/server/auth/reader'
import { setUserRole } from '@/server/db/user-repo'
import { hasRoles } from '@/server/auth/ctx'
import { verifyTotpPin } from '@/server/totp/provider'
import { generatePassword, hashPassword } from '@/server/crypto/password'
import { applyCookies, buildAuthCookies, buildClearAuthCookies, readRid } from '@/server/http/cookie'
import { refresh } from '@/server/auth/service'
import { updateUserProfileById } from '@/server/db/user-profile-repo'

/* ---------------------------------------------------------------------- */

type Body = {  first_name: string, last_name:string, phone_number:string, timezone:string }

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
    const sess = await readSession(req)
    if (!sess) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

    let body: Body
    try {
        body = await req.json()
        updateUserProfileById(sess.user_id,body.first_name,body.last_name,body.phone_number,body.timezone)

    } catch {
        return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, error: 'verification_failed' })
}
