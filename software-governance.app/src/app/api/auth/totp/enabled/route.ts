/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { read as readSession } from '@/server/auth/reader'
import { getTotpInfo } from '@/server/db/user-repo'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'
import { getSessionAndRefresh } from '@/server/auth/ctx'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
        const sessionGuardian = await getSessionAndRefresh(req)
        if (!sessionGuardian) return jsonErr('generic_issue',sessionGuardian, 401)
        const sess = sessionGuardian.session
        if (!sess) return jsonErr('not_authenticated',sessionGuardian, 401)
   

    const result = await getTotpInfo(sess.user_id)
    return jsonOk(result,sessionGuardian)
}
