/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { read as readSession } from '@/server/auth/reader'
import { verifyTotpPin } from '@/server/totp/provider'

/* ---------------------------------------------------------------------- */

type Body = { code?: string }

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  const sess = await readSession(req)
  if (!sess) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  const code = String(body.code || '').trim()
  if (!code) return NextResponse.json({ ok: false, error: 'missing_code' }, { status: 400 })

  const result = await verifyTotpPin(sess.user_id, code)
  if (!result.ok) return NextResponse.json(result, { status: 400 })

  return NextResponse.json({ ok: true })
}
