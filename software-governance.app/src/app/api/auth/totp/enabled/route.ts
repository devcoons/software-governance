/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { read as readSession } from '@/server/auth/reader'
import { getTotpInfo } from '@/server/db/user-repo'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
    const sess = await readSession(req)
    if (!sess) return jsonErr('unauthenticated', 401)

    const result = await getTotpInfo(sess.user_id)
    return jsonOk(result)
}
