/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { read as readSession } from '@/server/auth/reader'
import { updateUserProfileById } from '@/server/db/user-profile-repo'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'
import { getSessionAndRefresh } from '@/server/auth/ctx'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

const BodySchema = z.object({
    first_name: z.string().trim().max(100),
    last_name: z.string().trim().max(100),
    phone_number: z.string().trim().max(32),
    timezone: z.string().trim().max(80).regex(/^[A-Za-z0-9_\-\/+]+$/),
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

    const profile = await updateUserProfileById(
        sess.user_id,
        body.first_name,
        body.last_name,
        body.phone_number,
        body.timezone
    )

    return jsonOk(profile,sessionGuardian)
}
