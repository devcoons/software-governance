// app/api/me/profile/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { updateUserProfileById } from '@/server/db/user-profile-repo'
import { NextRequest, NextResponse } from 'next/server'
import { withSession } from '@/server/http/with-session'
import { z } from 'zod'


const BodySchema = z.object({
    first_name: z.string().trim().max(100),
    last_name: z.string().trim().max(100),
    phone_number: z.string().trim().max(32),
    timezone: z.string().trim().max(80),
}).refine(obj => Object.keys(obj).length > 0, { message: 'empty_patch' })

export const POST = withSession(async (req: NextRequest, _ctx, session) => {
  // (Optional) CSRF: require a header that matches a non-HttpOnly cookie
  // const csrf = req.headers.get('x-csrf')
  // if (!csrf || csrf !== cookies().get('csrf')?.value) return NextResponse.json({ ok:false, error:'csrf' }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_payload', issues: parsed.error.format() }, { status: 400 })
  }

  const userId = session.user_id
  try {
    const updated = await updateUserProfileById(
        userId,
        parsed.data.first_name,
        parsed.data.last_name,
        parsed.data.phone_number,
        parsed.data.timezone
    )

    return NextResponse.json({
      ok: true,
      profile: {
        id: updated.user_id,
        firstName: updated.first_name,
        lastName: updated.last_name,
        phoneNumber: updated.phone_number,
        timezome: updated.timezone,
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  }
})
