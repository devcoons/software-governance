/* src/app/api/admin/users/change-role/route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { read as readSession } from '@/server/auth/reader'
import { setUserRole } from '@/server/db/user-repo'
import { getSessionAndRefresh, hasRoles } from '@/server/auth/ctx'
import { verifyTotpPin } from '@/server/totp/provider'
import { generatePassword } from '@/server/crypto/password'
import { applyCookies, buildAuthCookies, buildClearAuthCookies, readRid } from '@/server/http/cookie'
import { refresh } from '@/server/auth/service'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

const BodySchema = z.object({
    userId: z.string().trim().uuid(),
    role: z.enum(['admin', 'user', 'viewer']),
    totp: z.string().trim().regex(/^\d{6}$/),
})

/* ---------------------------------------------------------------------- */

type Body = z.infer<typeof BodySchema>

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
    const sessionGuardian = await getSessionAndRefresh(req)
    if (!sessionGuardian) return jsonErr('generic_issue',sessionGuardian, 401)
    const sess = sessionGuardian.session
    if (!sess) return jsonErr('not_authenticated',sessionGuardian, 401)

    if (!hasRoles(sess, ['admin'])) return jsonErr('requires_admin_level',sessionGuardian, 401)

    let body: Body
    try {
    body = BodySchema.parse(await req.json())
    } catch {
    return jsonErr('bad_request',sessionGuardian, 400)
    }

    const verification = await verifyTotpPin(sess.user_id, body.totp)
    if (!verification.ok) return jsonErr(verification.error ?? 'verification_failed',sessionGuardian, 400)

    const new_password = generatePassword()
    await setUserRole(body.userId, [body.role])

    const res = jsonOk({ password: new_password },sessionGuardian)

    if (body.userId === sess.user_id) {
        const rid = readRid(req)
        if (!rid) {
            const r = jsonErr('no_refresh',sessionGuardian, 401)
            applyCookies(r, buildClearAuthCookies())
            return r
        }
        const result = await refresh(req, rid)
        if (!result.ok) {
            const r = jsonErr(result.error ?? 'refresh_failed',sessionGuardian, 401)
            applyCookies(r, buildClearAuthCookies())
            return r
        }
        applyCookies(res, buildAuthCookies({ sid: result.sid, rid: result.rid, rememberMe: result.rememberMe }))
    }
    return res
}
