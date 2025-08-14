/* cookie.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextResponse, type NextRequest } from 'next/server'
import config from '@/config'

/* ---------------------------------------------------------------------- */

export type CookieDescriptor = Readonly<{
  name: string
  value: string
  options: {
    httpOnly: true
    secure: boolean
    sameSite: 'lax' | 'strict' | 'none'
    path: string
    maxAge?: number
  }
}>

/* ---------------------------------------------------------------------- */

export function buildAuthCookies(input: { sid: string; rid: string; rememberMe: boolean }): CookieDescriptor[] {
  const base = {
    secure: Boolean(config.COOKIE_SECURE),
    sameSite: config.COOKIE_SAMESITE as 'lax' | 'strict' | 'none',
    path: config.COOKIE_PATH,
  }
  const sid: CookieDescriptor = {
    name: config.SESSION_COOKIE,
    value: input.sid,
    options: { httpOnly: true, ...base, maxAge: Number(config.SESSION_TTL_SECONDS) },
  }
  const rid: CookieDescriptor = {
    name: config.REFRESH_COOKIE,
    value: input.rid,
    options: input.rememberMe
      ? { httpOnly: true, ...base, maxAge: Number(config.REFRESH_IDLE_TTL_SECONDS) }
      : { httpOnly: true, ...base },
  }
  return [sid, rid]
}

/* ---------------------------------------------------------------------- */

export function buildClearAuthCookies(): CookieDescriptor[] {
  const base = {
    secure: Boolean(config.COOKIE_SECURE),
    sameSite: config.COOKIE_SAMESITE as 'lax' | 'strict' | 'none',
    path: config.COOKIE_PATH,
    maxAge: 0,
  }
  return [
    { name: config.SESSION_COOKIE, value: '', options: { httpOnly: true, ...base } },
    { name: config.REFRESH_COOKIE, value: '', options: { httpOnly: true, ...base } },
  ]
}

/* ---------------------------------------------------------------------- */

export function applyCookies(res: NextResponse, cookies: CookieDescriptor[]) {
  for (const c of cookies) {
    res.cookies.set(c.name, c.value, c.options)
  }
}

/* ---------------------------------------------------------------------- */

export function readSid(req: NextRequest): string | null {
  return req.cookies.get(config.SESSION_COOKIE)?.value ?? null
}

/* ---------------------------------------------------------------------- */

export function readRid(req: NextRequest): string | null {
  return req.cookies.get(config.REFRESH_COOKIE)?.value ?? null
}
