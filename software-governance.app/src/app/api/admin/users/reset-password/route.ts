/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { read as readSession } from '@/server/auth/reader'
import { deleteUser, setUserTempPassword } from '@/server/db/user-repo'
import { hasRoles } from '@/server/auth/ctx'
import { verifyTotpPin } from '@/server/totp/provider'
import { generatePassword, hashPassword } from '@/server/crypto/password'

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
        const new_password =  generatePassword();
        await setUserTempPassword(body.userId, await hashPassword(new_password));
      
        return NextResponse.json({ ok: true, password: new_password })
    }
  return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 400 })

}
