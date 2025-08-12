// src/lib/cookies.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Edge-safe constants (read from env without any Node-only deps)
export const SESSION_COOKIE =
  process.env.SESSION_COOKIE || 'sid';
export const REFRESH_COOKIE =
  process.env.REFRESH_COOKIE || 'rid';

export const SESSION_TTL_SECONDS =
  parseInt(process.env.SESSION_TTL_SECONDS || '3600', 10);        // 1h
export const REFRESH_TTL_SECONDS =
  parseInt(process.env.REFRESH_TTL_SECONDS || '2592000', 10);     // 30d

const isProd = process.env.NODE_ENV === 'production';

// Set short-lived session cookie
export function setSessionCookie(res: NextResponse, id: string) {
  res.cookies.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

// Set long-lived refresh cookie
export function setRefreshCookie(res: NextResponse, id: string) {
  res.cookies.set(REFRESH_COOKIE, id, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

// Clear both cookies
export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  res.cookies.set(REFRESH_COOKIE, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

// Convenience helper for handlers that don't have a NextResponse yet
export async function readCookie(name: string) {
  return (await cookies()).get(name)?.value || null;
}
