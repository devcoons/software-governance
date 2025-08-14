/* reader.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import 'server-only'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import config from '@/config'
import { store } from '@/server/session/provider'
import type { SessionRecord } from '@/server/session/store.i'

/* ---------------------------------------------------------------------- */

export async function read(req?: NextRequest): Promise<SessionRecord | null> {
  const sid = req
    ? req.cookies.get(config.SESSION_COOKIE)?.value || null
    : (await cookies()).get(config.SESSION_COOKIE)?.value || null
  if (!sid) return null
  return store.getSession(sid)
}

/* ---------------------------------------------------------------------- */

export async function require(req?: NextRequest): Promise<SessionRecord> {
  const sess = await read(req)
  if (!sess) {
    throw new Error('unauthenticated')
  }
  return sess
}
