/* app/api/auth/totp/setup/route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { read as readSession } from '@/server/auth/reader'
import { setupTotp, buildKeyUri } from '@/server/totp/provider'
import { getTotpInfo } from '@/server/db/user-repo'
import { applyCookies } from '@/server/http/cookie'
import config from '@/config'

/* ---------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  const sess = await readSession(req)
  if (!sess) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  const issuer = String(config.TOTP_ISSUER || 'Software Governance')
  const account = sess.claims.email || sess.claims.username || sess.user_id

  if (sess.claims.totp_enabled) {
    const info = await getTotpInfo(sess.user_id)
    if (!info.secret) {
      return NextResponse.json({ ok: false, error: 'no_secret' }, { status: 400 })
    }
    const otpauthUrl = buildKeyUri({ account, issuer, secret: info.secret })
    return NextResponse.json({ ok: true, issuer, account, otpauthUrl })
  }

  const r = await setupTotp(sess.user_id, issuer, { session: sess })

  const res = NextResponse.json({
    ok: true,
    issuer: r.issuer,
    account: r.account,
    otpauthUrl: r.otpauthUrl,
  })

  if (r.cookies.length > 0) applyCookies(res, r.cookies)

  return res
}
