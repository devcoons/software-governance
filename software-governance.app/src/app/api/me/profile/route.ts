/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { read as readSession } from '@/server/auth/reader'
import { updateUserProfileById } from '@/server/db/user-profile-repo'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

const BodySchema = z.object({
  first_name: z.string().trim().max(100),
  last_name: z.string().trim().max(100),
  phone_number: z.string().trim().max(32),
  timezone: z.string().trim().max(80).regex(/^[A-Za-z0-9_\-\/+]+$/),
})

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  const sess = await readSession(req)
  if (!sess) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  const profile = await updateUserProfileById(
    sess.user_id,
    body.first_name,
    body.last_name,
    body.phone_number,
    body.timezone
  )

  return NextResponse.json({ ok: true, profile })
}
