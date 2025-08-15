/* route.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { read as readSession } from '@/server/auth/reader'
import { createUserWithTempPassword, setUserTempPassword } from '@/server/db/user-repo'
import { hasRoles } from '@/server/auth/ctx'
import { verifyTotpPin } from '@/server/totp/provider'
import { generatePassword, hashPassword } from '@/server/crypto/password'
import { jsonErr, jsonOk } from '@/server/http/api-reponse'

/* ---------------------------------------------------------------------- */

export const runtime = 'nodejs'

/* ---------------------------------------------------------------------- */

const BodySchema = z.object({
    email: z.string().trim().min(1),
    role:  z.string().trim().lowercase()
})

/* ---------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
    const sess = await readSession(req)
    if (!sess) return jsonErr('unauthenticated', 401)
    if (!hasRoles(sess, ['admin'])) return jsonErr('requires_admin_level', 401)

    let body: z.infer<typeof BodySchema>
    try {
        body = BodySchema.parse(await req.json())
    } catch {
        return jsonErr('bad_request', 400)
    }

    const new_password = generatePassword()
    const hash = await hashPassword(new_password)
    const id = await createUserWithTempPassword(body.email, hash,[body.role])

    return jsonOk({ password: new_password })
}
