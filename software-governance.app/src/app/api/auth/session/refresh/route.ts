/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { refresh } from '@/server/auth/service'
import { readRid, applyCookies, buildAuthCookies /*, buildClearAuthCookies */ } from '@/server/http/cookie'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
       console.log('refresh started')
    const rid = readRid(req)
    if (!rid) return jsonErr('missing_refresh', 401)

    const result = await refresh(req, rid)
    if (!result.ok) {
        console.log('rotation_failed')
        return jsonErr(result.error ?? 'rotation_failed', 401)
    }

    const r = jsonOk({}) // avoid spreading null in jsonOk
    applyCookies(r, buildAuthCookies({ sid: result.sid, rid: result.rid, rememberMe: result.rememberMe }))
    r.headers.set('Cache-Control', 'no-store')
       console.log('refresh done success')
    return r
}
