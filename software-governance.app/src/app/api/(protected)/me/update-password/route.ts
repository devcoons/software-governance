// app/api/me/update-password/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { withSession } from '@/server/http/with-session' // wrapper we wrote earlier (inline refresh + ALS)
import { z } from 'zod'
import app from '@/config'
import { queueCookie } from '@/server/http/cookie-finalizer'
import { verifyPassword, hashPassword } from '@/libs/password'
import { findUserById, updateUserPassword } from '@/server/db/user-repo' // implement updateUserPassword(userId, newHash)
import { redisStore } from '@/server/auth/redis'

// --- validation ---
const BodyZ = z.object({
    currentPassword: z.string().min(1, 'required'),
    newPassword: z
        .string()
        .min(8, 'min_8')
        .max(128, 'max_128'),
})

const base = { path: '/', sameSite: 'lax' as const, secure: true }

export const POST = withSession(async (req: NextRequest, _ctx, session) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
    }
    console.log(body)
    const parsed = BodyZ.safeParse(body)
    console.log(parsed)
    if (!parsed.success) {
        return NextResponse.json(
        { ok: false, error: 'invalid_payload', issues: parsed.error.format() },
        { status: 400 }
        )
    }

    const { currentPassword, newPassword } = parsed.data
    const userId = session.user_id

    // Load user and check current password
    const user = await findUserById(userId)
    if (!user || !user.is_active) {
        return NextResponse.json({ ok: false, error: 'user_not_active' }, { status: 403 })
    }

    const ok = await verifyPassword(user.password, currentPassword)
    if (!ok) {
        return NextResponse.json({ ok: false, error: 'invalid_current_password' }, { status: 401 })
    }

    // Prevent no-op change
    const same = await verifyPassword(user.password, newPassword)
    if (same) {
        return NextResponse.json({ ok: false, error: 'password_unchanged' }, { status: 400 })
    }

    // Update password in DB
    const newHash = await hashPassword(newPassword)
    try {
        await updateUserPassword(userId, newHash)
    } catch {
        return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
    }

    // Revoke *all* auth artifacts (defense-in-depth)
    try {
        await Promise.all([
        redisStore.revokeUserRefresh(userId),
        redisStore.revokeUserSessions(userId),
        ])
    } catch {
        // even if revoke fails, proceed to clear client cookies
    }

    // Clear cookies on the response (so subsequent calls are unauthenticated)
    queueCookie({ name: app.SESSION_COOKIE, value: '', options: { ...base, httpOnly: true, maxAge: 0 } })
    queueCookie({ name: app.REFRESH_COOKIE, value: '', options: { ...base, httpOnly: true, maxAge: 0 } })
    queueCookie({ name: 'sid_hint', value: '', options: { ...base, maxAge: 0 } })

    return NextResponse.json({ ok: true, reauth: true })
})
