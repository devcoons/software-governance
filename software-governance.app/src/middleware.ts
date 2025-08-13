// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, FORCE_PWD_COOKIE } from '@/lib/cookies';

const PUBLIC_ALWAYS: RegExp[] = [
  /^\/api\/logout$/,
  /^\/api\/health\/.*$/,
  /^\/maintenance\/.*$/,
];

const PUBLIC: RegExp[] = [
  /^\/$/,                   // keep if homepage is public
  /^\/login(?:\/|$)$/,
  /^\/api\/login(?:\/|$)$/,
  /^\/api\/session\/refresh(?:\/|$)$/, // refresh API must be public
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

/** Simple matcher */
const matches = (list: RegExp[], p: string) => list.some((re) => re.test(p));

/** Build a safe "next" target that never points to API/static */
function buildSafeNext(req: NextRequest): string {
  const path = req.nextUrl.pathname;
  const search = req.nextUrl.search || '';

  // Never allow APIs or internal assets as next targets
  if (
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path.startsWith('/public') ||
    path === '/favicon.ico'
  ) {
    return '/dashboard';
  }
  // Avoid protocol-relative or malformed
  if (!path.startsWith('/')) return '/dashboard';
  return `${path}${search}`;
}

async function isHealthy(req: NextRequest): Promise<boolean> {
  try {
    const url = new URL('/api/health/ready', req.url);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(url, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'x-internal-health': '1' },   // <— tag request
    });
    clearTimeout(t);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.ok;
  } catch {
    return false;
  }
}



export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/health/ready')) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/maintenance')) {
    return NextResponse.next();
  }
  const healthy = await isHealthy(req);
  if(!healthy) {
      return NextResponse.redirect(new URL('/maintenance', req.url));
  }

  const res = NextResponse.next();
  res.headers.set('x-invoke-path', `${req.nextUrl.pathname}${req.nextUrl.search}`);

  // 0) Unconditional bypasses
  if (matches(PUBLIC_ALWAYS, pathname)) return NextResponse.next();

  
  // 1) Force-password gate (cookie only, no network calls)
  const isForced = req.cookies.get(FORCE_PWD_COOKIE)?.value === '1';
  if (isForced && !matches(FORCE_ALLOWED, pathname)) {
    const url = req.nextUrl.clone();
    if (url.pathname !== '/auth/force-change') {
      url.pathname = '/auth/force-change';
      url.search = ''; // break potential chains
    }
    return NextResponse.redirect(url);
  }

  // 2) Public pages/APIs
  if (matches(PUBLIC, pathname)) return NextResponse.next();

  // 3) Guarded pages/APIs: require presence of session cookie (no validation here)
  if (matches(SESSION_GUARDED, pathname)) {
    const sid = req.cookies.get(SESSION_COOKIE)?.value;
    if (!sid) {
      // Send the browser directly to the API refresh endpoint so cookies are included
      const url = req.nextUrl.clone();
      url.pathname = '/api/session/refresh';
      url.search = `?next=${encodeURIComponent(buildSafeNext(req))}`;
      // 307 preserves method, the API will respond with 303 onward to the page
      return NextResponse.redirect(url, { status: 307 });
    }
  }

  // 4) Everything else is public
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Exclude common static/assets and health
    '/((?!_next|static|favicon.ico|robots.txt|sitemap.xml|images|public|api/health).*)',
  ],
};
