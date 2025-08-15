/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { read as readSession } from '@/server/auth/reader'
import { deleteUser } from '@/server/db/user-repo'
import { hasRoles } from '@/server/auth/ctx'
import { verifyTotpPin } from '@/server/totp/provider'
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
    const sess = await readSession(req)
    if (!sess) return jsonErr('unauthenticated', 401)
    if (!hasRoles(sess, ['admin'])) return jsonErr('requires_admin_level', 401)

    let body: z.infer<typeof BodySchema>
    try {
        body = BodySchema.parse(await req.json())
    } catch {
        return jsonErr('bad_request', 400)
    }

    const verification = await verifyTotpPin(sess.user_id, body.totp)
    if (!verification.ok) return jsonErr(verification.error ?? 'verification_failed', 400)

    await deleteUser(body.userId)
    return jsonOk({ deleted: true })
}
