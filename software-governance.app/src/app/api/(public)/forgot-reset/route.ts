/* ---------------------------------------------------------------------- */
/* Filepath: src/app/api/(public)/forgot-reset/route.ts */
/* ---------------------------------------------------------------------- */

import { hashPassword } from "@/libs/password";
import { sanitizeNext } from "@/server/auth/ctx";
import { getUserIdByUsername, updateUserPassword } from "@/server/db/user-repo";
import { withCookieContext } from "@/server/http/cookie-finalizer";
import { verifyTotpPin } from "@/server/totp/provider";
import { init } from "next/dist/compiled/webpack/webpack";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/* ---------------------------------------------------------------------- */

export const runtime = "nodejs";

/* ---------------------------------------------------------------------- */

const BodySchema = z.object({
  username: z.string().min(1).max(128),
  newPassword: z.string().min(10), // full policy is applied in the service
  totp: z.string().regex(/^\d{6}$/),
});

/* ---------------------------------------------------------------------- */

type ErrCode =
  | "invalid_totp"
  | "weak_password"
  | "rate_limited"
  | "not_allowed"
  | 'invalid_payload'
  | "unknown";

/* ---------------------------------------------------------------------- */

export const POST = withCookieContext(async (req: NextRequest) => {
    const url = new URL(req.url)
    const wantsRedirect = url.searchParams.get('redirect') === '1' || url.searchParams.has('next')
    const nextPath = sanitizeNext(url.searchParams.get('next'))
    
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

    const user = await getUserIdByUsername(parsed.data.username)
    if (!user) {
        return NextResponse.json({ ok: false, error: "unknown" },{ status: 400 })
    }

    const result = await verifyTotpPin(user.id, parsed.data.totp)
    if (!result.ok) {
        const status = result.error === 'invalid_code' ? 400 : 400
        return NextResponse.json({ ok: false, error: result.error }, { status })
    }

    const newHash = await hashPassword(parsed.data.newPassword)
    try {
        await updateUserPassword(user.id, newHash)
    } catch {
        return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true });
})

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */