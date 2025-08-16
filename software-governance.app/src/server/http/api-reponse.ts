// src/server/http/api-response.ts
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextResponse } from 'next/server'
import { GetSessionAndRefreshResult } from '../auth/ctx'
import { applyCookies } from './cookie'

/* ---------------------------------------------------------------------- */

export function jsonOk<T>(data: T, guard?: GetSessionAndRefreshResult|null, init?: number | ResponseInit) {
  const opts = typeof init === 'number' ? { status: init } : init
    const res = NextResponse.json({ ok: true, ...data }, opts)
  if(guard){
    if (guard.cookies?.length) {
        applyCookies(res, guard.cookies)
        res.headers.set('Cache-Control', 'no-store')
    }
    }
  return res
}

/* ---------------------------------------------------------------------- */

export function jsonErr(error: string, guard?: GetSessionAndRefreshResult|null, init?: number | ResponseInit,) {
  const opts = typeof init === 'number' ? { status: init } : init
  const res = NextResponse.json({ ok: false, error }, opts)
  if(guard){
    if (guard.cookies?.length) {
        applyCookies(res, guard.cookies)
        res.headers.set('Cache-Control', 'no-store')
    }
    }
  return  res
}
