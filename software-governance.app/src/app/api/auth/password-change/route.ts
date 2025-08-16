/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { readSid, applyCookies, buildAuthCookies, readRid } from '@/server/http/cookie'
import { newRefresh } from '@/server/session/utils'
import { getUaHash, getIpHint } from '@/server/auth/ua-ip'
import { store } from '@/server/session/provider'
import { hashPassword } from '@/server/crypto/password'
import { completeForcedPasswordChange, findUserById } from '@/server/db/user-repo'
import { newSession } from '@/server/session/utils'
import config from '@/config'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'
import { getSessionAndRefresh } from '@/server/auth/ctx'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

const BodySchema = z.object({
    newPassword: z.string().min(1),
    confirm: z.string().min(1),
})

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
   
    



    let body: z.infer<typeof BodySchema>
    try {
        body = BodySchema.parse(await req.json())
    } catch {
        return jsonErr('bad_request',null, 400)
    }

    const newPassword = String(body.newPassword ?? '')
    const confirm = String(body.confirm ?? '')
    if (!newPassword || newPassword !== confirm) {
        return jsonErr('password_mismatch',null, 400)
    }

    const sid = readSid(req)
    if (!sid) return jsonErr('no_session',null, 401)

    const sessionGuardian = await getSessionAndRefresh(req)
    if (!sessionGuardian) return jsonErr('generic_issue',sessionGuardian, 401)
    const sess = sessionGuardian.session
    if (!sess) return jsonErr('invalid_session',sessionGuardian, 401)

    if (!sess.claims.force_password_change) {
        return jsonErr('not_forced',sessionGuardian, 400)
    }

    const user = await findUserById(sess.user_id)
    if (!user || !user.is_active) {
        return jsonErr('user_not_active',sessionGuardian, 401)
    }

    const hash = await hashPassword(newPassword)
    await completeForcedPasswordChange(user.id, hash)
    await store.revokeUserSessions(user.id, sid)

    const updatedClaims = {
        ...sess.claims,
        force_password_change: false,
        temp_password_issued_at: null,
        temp_password_used_at: null,
    }

    const next = newSession(user.id, updatedClaims)

    await store.deleteSession(sid)
    await store.putSession(next)

    const res = jsonOk({},sessionGuardian)

    const sidOnly = buildAuthCookies({ sid: next.sid, rid: 'ignore', rememberMe: false })
                    .filter(c => c.name === config.SESSION_COOKIE)
    applyCookies(res, sidOnly)

    return res
}
