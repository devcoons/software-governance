/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { logout } from '@/server/auth/service'
import { readSid, readRid, applyCookies, buildClearAuthCookies } from '@/server/http/cookie'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
    const r = await logout({ sid: readSid(req), rid: readRid(req) })
    const res = r.ok ? jsonOk({}) : jsonErr('logout_failed', 401)
    applyCookies(res, buildClearAuthCookies())
    return res
}
