// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, FORCE_PWD_COOKIE } from '@/lib/cookies';
import { headers } from 'next/headers';

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
  /^\/users(?:\/|$)/,
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

async function fetchHealth(timeoutMs = 1000) {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  if (!host) return { ok: false, db: false, redis: false };

  const base = `${proto}://${host}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/api/health/ready`, {
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, db: false, redis: false };
    return (await res.json()) as { ok: boolean; db: boolean; redis: boolean };
  } catch {
    return { ok: false, db: false, redis: false };
  } finally {
    clearTimeout(timer);
  }
}



export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/maintenance')) {
    return NextResponse.next();
  }
  const healthy = await fetchHealth(1500);
  console.log("Middleware: ");
  console.log(healthy);
  if(!healthy.ok) {    
      return NextResponse.redirect(new URL('/maintenance', req.url));
  }

  const res = NextResponse.next();
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
