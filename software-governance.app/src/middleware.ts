// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, FORCE_PWD_COOKIE } from '@/lib/cookies';

const PUBLIC_ALWAYS: RegExp[] = [
  /^\/api\/logout$/,
  /^\/api\/health\/.*$/,
];

const PUBLIC: RegExp[] = [
  /^\/$/,                 // if your homepage is public; remove if not
  /^\/login(?:\/|$)$/,    // <-- login must be public
  /^\/auth\/refresh(?:\/|$)$/,
  /^\/api\/login(?:\/|$)$/,
  /^\/api\/session\/refresh(?:\/|$)$/,
];

const SESSION_GUARDED: RegExp[] = [
  /^\/dashboard(?:\/|$)/,
  /^\/registry(?:\/|$)/,
  /^\/approvals(?:\/|$)/,
  /^\/compliance(?:\/|$)/,
  /^\/audit(?:\/|$)/,
  /^\/users(?!\/me)(?:\/|$)/,
  // Guarded APIs:
  /^\/api\/users(?:\/|$)/,
  /^\/api\/registry(?:\/|$)/,
  /^\/api\/approvals(?:\/|$)/,
  /^\/api\/audit(?:\/|$)/,
];

const FORCE_ALLOWED: RegExp[] = [
  /^\/auth\/force-change(?:\/|$)$/,
  /^\/api\/users\/force-password(?:\/|$)$/,
  /^\/api\/logout(?:\/|$)$/,
  /^\/_next\//,
  /^\/public\//,
];

const matches = (list: RegExp[], p: string) => list.some((re) => re.test(p));

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 0) Bypass
  if (matches(PUBLIC_ALWAYS, pathname)) return NextResponse.next();

  // 1) Global force-password gate (cookie-only, no fetch)
  const isForced = req.cookies.get(FORCE_PWD_COOKIE)?.value === '1';
  if (isForced && !matches(FORCE_ALLOWED, pathname)) {
    const url = req.nextUrl.clone();
    if (url.pathname !== '/auth/force-change') {
      url.pathname = '/auth/force-change';
      url.search = ''; // avoid redirect chains
    }
    return NextResponse.redirect(url);
  }

  // 2) Public pages/APIs
  if (matches(PUBLIC, pathname)) return NextResponse.next();

  // 3) Guarded pages/APIs require a session cookie (we don’t validate it here)
  if (matches(SESSION_GUARDED, pathname)) {
    const sid = req.cookies.get(SESSION_COOKIE)?.value;
    if (!sid) {
      const url = req.nextUrl.clone();
      const next = encodeURIComponent(pathname + (search || ''));
      url.pathname = '/auth/refresh';
      url.search = `?next=${next}`;
      return NextResponse.redirect(url);
    }
  }

  // 4) Everything else is public
  return NextResponse.next();
}

export const config = {
  matcher: [
    // exclude static and health
    '/((?!_next|static|favicon.ico|robots.txt|sitemap.xml|images|public|api/health).*)',
  ],
};
