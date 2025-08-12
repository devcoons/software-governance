// src/lib/cookies.ts
import type { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = process.env.SESSION_COOKIE || 'sid';
export const REFRESH_COOKIE = process.env.REFRESH_COOKIE || 'rid';
export const FORCE_PWD_COOKIE = 'fp';

export const SESSION_TTL_SECONDS = parseInt(process.env.SESSION_TTL_SECONDS || '3600', 10);
export const REFRESH_TTL_SECONDS = parseInt(process.env.REFRESH_TTL_SECONDS || '2592000', 10);

const isProd = process.env.NODE_ENV === 'production';

export function setSessionCookie(res: NextResponse, id: string) {
  res.cookies.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function setRefreshCookie(res: NextResponse, id: string) {
  res.cookies.set(REFRESH_COOKIE, id, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

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

// ✅ Works in both Node and Edge runtimes
export async function readCookie(name: string): Promise<string | null> {
  const jar = await cookies();
  return jar.get(name)?.value ?? null;
}

export async function readBoolCookie(name: string): Promise<boolean> {
  const jar = await cookies();
  return jar.get(name)?.value === '1';
}

export function setForcePwdCookie(res: NextResponse, on: boolean) {
  if (on) {
    res.cookies.set(FORCE_PWD_COOKIE, '1', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 3600,
    });
  } else {
    res.cookies.set(FORCE_PWD_COOKIE, '', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}
