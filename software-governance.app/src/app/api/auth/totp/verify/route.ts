/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { read as readSession } from '@/server/auth/reader'
import { verifyTotpPin } from '@/server/totp/provider'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'
import { getSessionAndRefresh } from '@/server/auth/ctx'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

const BodySchema = z.object({
    code: z.string().trim().min(1),
})

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
    const sessionGuardian = await getSessionAndRefresh(req)
    if (!sessionGuardian) return jsonErr('generic_issue',sessionGuardian, 401)
    const sess = sessionGuardian.session
    if (!sess) return jsonErr('not_authenticated',sessionGuardian, 401)

    let body: z.infer<typeof BodySchema>
    try {
        body = BodySchema.parse(await req.json())
    } catch {
        return jsonErr('bad_request',sessionGuardian, 400)
    }

    const result = await verifyTotpPin(sess.user_id, body.code)
    if (!result.ok) 
        return jsonErr(result.error ?? 'verification_failed',sessionGuardian, 400)

    return jsonOk({},sessionGuardian)
}
