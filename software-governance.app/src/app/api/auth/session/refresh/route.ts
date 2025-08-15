/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { refresh } from '@/server/auth/service'
import { readRid, applyCookies, buildAuthCookies, buildClearAuthCookies } from '@/server/http/cookie'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
    const rid = readRid(req)
    if (!rid) {
        const r = jsonErr('no_refresh',401) 
        applyCookies(r, buildClearAuthCookies())
        return r
    }

    const result = await refresh(req, rid)
    if (!result.ok) {
        const r = jsonErr(result.error,401) 
        applyCookies(r, buildClearAuthCookies())
        return r
    }
    
    const r = jsonOk(null) 
    applyCookies(r, buildAuthCookies({ sid: result.sid, rid: result.rid, rememberMe: result.rememberMe }))
    return r
}
