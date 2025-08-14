/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { read as readSession } from '@/server/auth/reader'
import { getTotpInfo } from '@/server/db/user-repo'

/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  const sess = await readSession(req)

  if (!sess) return NextResponse.json(null, { status: 401 })

  const result = await getTotpInfo(sess.user_id)

  return NextResponse.json(result)

}
