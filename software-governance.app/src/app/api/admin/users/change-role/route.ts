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

/* ---------------------------------------------------------------------- */

type Body = { userId: string, role: string, totp:string }

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
        await setUserRole(body.userId, [body.role]);
        const res = NextResponse.json({ ok: true, password: new_password })
        if(body.userId == sess.user_id)
        {
           const rid = readRid(req)
             if (!rid) {
               const r = NextResponse.json({ ok: false, error: 'no_refresh' }, { status: 401 })
               applyCookies(r, buildClearAuthCookies())
               return r
             }
           
             const result = await refresh(req, rid)
             if (!result.ok) {
               const r = NextResponse.json({ ok: false, error: result.error }, { status: 401 })
               applyCookies(r, buildClearAuthCookies())
               return r
             }
             applyCookies(res, buildAuthCookies({ sid: result.sid, rid: result.rid, rememberMe: result.rememberMe }))
        }
      
        return res
    }
  return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 400 })

}
