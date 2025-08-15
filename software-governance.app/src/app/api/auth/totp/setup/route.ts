/* app/api/auth/totp/setup/route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { read as readSession } from '@/server/auth/reader'
import { setupTotp, buildKeyUri } from '@/server/totp/provider'
import { getTotpInfo } from '@/server/db/user-repo'
import { applyCookies } from '@/server/http/cookie'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'
import config from '@/config'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
    const sess = await readSession(req)
    if (!sess) return jsonErr('unauthenticated', 401)

    const issuer = String(config.TOTP_ISSUER || 'Software Governance')
    const account = sess.claims.email || sess.claims.username || sess.user_id

    if (sess.claims.totp_enabled) {
        const info = await getTotpInfo(sess.user_id)
        if (!info.secret) 
            return jsonErr('no_secret', 400)
        const otpauthUrl = buildKeyUri({ account, issuer, secret: info.secret })
        return jsonOk({ issuer, account, otpauthUrl })
    }

    const r = await setupTotp(sess.user_id, issuer, { session: sess })
    const res = jsonOk({ issuer: r.issuer, account: r.account, otpauthUrl: r.otpauthUrl })
    if (r.cookies.length > 0) applyCookies(res, r.cookies)
    return res
}
