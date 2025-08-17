/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getSessionAndRefresh, hasRoles } from '@/server/auth/ctx'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'
import { getUserProfileById } from '@/server/db/user-profile-repo'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
    const sessionGuardian = await getSessionAndRefresh(req)
    if (!sessionGuardian?.session) return jsonErr('unauthorized', null, 401, true)

    const sess = sessionGuardian.session
    if (!hasRoles(sess, ['admin'])) return jsonErr('forbidden', sessionGuardian, 403, true)

    const url = new URL(req.url)
    const qs = Object.fromEntries(url.searchParams.entries())

    const QSchema = z.object({
        userId: z.string().uuid()
    })

    let query: z.infer<typeof QSchema>
    try {
        query = QSchema.parse(qs)
    } catch {
        return jsonErr('bad_request', sessionGuardian, 400, true)
    }

    try {
        const profile = await getUserProfileById(query.userId)
        console.log(profile)
        return jsonOk(profile, sessionGuardian, 200, true)
    } catch {
        return jsonErr('not_found', sessionGuardian, 404, true)
    }
}
