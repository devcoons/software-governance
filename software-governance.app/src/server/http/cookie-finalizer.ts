/* ---------------------------------------------------------------------- */
/* Filepath: src/server/http/cookie-finalizer.ts */
/* ---------------------------------------------------------------------- */

import { AsyncLocalStorage } from 'node:async_hooks'
import { NextResponse, type NextRequest } from 'next/server'
import { CookieSpec } from '@/types/provider'

/* ---------------------------------------------------------------------- */

const cookieALS = new AsyncLocalStorage<CookieSpec[]>()

/* ---------------------------------------------------------------------- */

export function queueCookie(spec: CookieSpec) {
	const bag = cookieALS.getStore()
	if (!bag) 
		throw new Error('queueCookie() used outside cookie context')
	bag.push(spec)
}

/* ---------------------------------------------------------------------- */

export function withCookieContext<T extends (req: NextRequest, ctx?: unknown) => Promise<Response | NextResponse | unknown>>(handler: T): T {
    return (async (req: NextRequest, ctx?: unknown) => {
        return cookieALS.run([], async () => {
            const result = await handler(req, ctx)

            // Normalize to NextResponse without losing body/status/headers
            let res: NextResponse
            if (result instanceof NextResponse) {
                res = result
            } else if (result instanceof Response) {
                res = new NextResponse(result.body, {
                status: result.status,
                statusText: result.statusText,
                headers: result.headers,
                })
            } else {
                res = NextResponse.json(result)
            }

            // Apply queued cookies at the very end (single writer)
            for (const c of cookieALS.getStore() ?? []) {
                res.cookies.set(c.name, c.value, c.options ?? {})
            }

            // Auth responses should not be cached
            res.headers.set('Cache-Control', 'no-store')
            return res
        })
    }) as T
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
