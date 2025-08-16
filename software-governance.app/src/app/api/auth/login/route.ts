/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { login } from '@/server/auth/service'
import { applyCookies, buildAuthCookies } from '@/server/http/cookie'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

const BodySchema = z.object({
    login: z.string().trim().min(1),
    password: z.string().min(1),
    rememberMe: z.boolean().optional().default(false),
})

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
    let body: z.infer<typeof BodySchema>
    try {
        body = BodySchema.parse(await req.json())
    } catch {
        return jsonErr('bad_request',null, 400)
    }

    const result = await login(req, {
        login: body.login,
        password: body.password,
        rememberMe: body.rememberMe ?? false,
    })

    if (!result.ok) {
        return jsonErr(result.error ?? 'invalid_credentials',null, 401)
    }

    const res = jsonOk({ force_password_change: result.forcePasswordChange })
    applyCookies(res, buildAuthCookies({ sid: result.sid, rid: result.rid, rememberMe: result.rememberMe }))
    return res
}
