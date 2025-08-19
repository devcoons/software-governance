/* ---------------------------------------------------------------------- */
/* Filepath: src/server/ua-ip.ts */
/* ---------------------------------------------------------------------- */

import { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import config from '@/config'

/* ---------------------------------------------------------------------- */

export function getUaHash(req: NextRequest): string {
    const ua = req.headers.get('user-agent') ?? ''
    const h = createHash('sha256').update(ua).digest('base64url')
    return h
}

/* ---------------------------------------------------------------------- */

export function getIpHint(req: NextRequest): string {

    if (!config.BIND_IP) 
        return ''
    
    const xf = req.headers.get('x-forwarded-for') ?? ''
    const xreal = req.headers.get('x-real-ip') ?? ''
    const cf = req.headers.get('cf-connecting-ip') ?? ''
    const fly = req.headers.get('fly-client-ip') ?? ''
    const vercel = req.headers.get('x-vercel-forwarded-for') ?? ''

    return  xf.split(',')[0]?.trim() ??
            xreal.trim() ??
            cf.trim() ??
            fly.trim() ??
            vercel.split(',')[0]?.trim() ??
            ''
}
