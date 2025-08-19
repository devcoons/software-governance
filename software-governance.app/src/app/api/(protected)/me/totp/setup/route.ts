// app/api/me/totp/setup/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { withSession } from '@/server/http/with-session'
import config from '@/config'
import { getOrCreateTotpUri } from '@/server/totp/provider'

export const GET = withSession(async (_req: NextRequest, _ctx, session) => {
  const issuer = String(config.TOTP_ISSUER || 'Software Governance')

  // If secret already exists (even when enabled), we just return THAT otpauth URL.
  const r = await getOrCreateTotpUri(session.user_id, issuer)
  return NextResponse.json(
    { ok: true, issuer: r.issuer, account: r.account, otpauthUrl: r.otpauthUrl, enabled: r.enabled },
    { headers: { 'Cache-Control': 'no-store' } }
  )
})
