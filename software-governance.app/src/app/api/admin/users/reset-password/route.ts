/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { read as readSession } from '@/server/auth/reader'
import { setUserTempPassword } from '@/server/db/user-repo'
import { getSessionAndRefresh, hasRoles } from '@/server/auth/ctx'
import { verifyTotpPin } from '@/server/totp/provider'
import { generatePassword, hashPassword } from '@/server/crypto/password'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

const BodySchema = z.object({
    userId: z.string().trim().uuid(),
    totp: z.string().trim().regex(/^\d{6}$/),
})

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
    const sessionGuardian = await getSessionAndRefresh(req)
    if (!sessionGuardian) return jsonErr('generic_issue',sessionGuardian, 401)
    const sess = sessionGuardian.session
    if (!sess) return jsonErr('not_authenticated',sessionGuardian, 401)
        
    if (!hasRoles(sess, ['admin'])) return jsonErr('requires_admin_level',sessionGuardian, 401)

    let body: z.infer<typeof BodySchema>
    try {
        body = BodySchema.parse(await req.json())
    } catch {
        return jsonErr('bad_request',sessionGuardian, 400)
    }

    const verification = await verifyTotpPin(sess.user_id, body.totp)
    if (!verification.ok) return jsonErr(verification.error ?? 'verification_failed',sessionGuardian, 400)

    const new_password = generatePassword()
    const hash = await hashPassword(new_password)
    await setUserTempPassword(body.userId, hash)

    return jsonOk({ password: new_password },sessionGuardian)
}
