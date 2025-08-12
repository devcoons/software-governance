import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, REFRESH_COOKIE, SESSION_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/cookies';

const GUARDS: RegExp[] = [
  /^\/dashboard/,
  /^\/registry/,
  /^\/approvals/,
  /^\/compliance/,
  /^\/audit/,
  /^\/users(?!\/me)/, // users admin area; /users/me handled per-page
];

async function isHealthy(req: NextRequest): Promise<boolean> {
  try {
    const url = new URL('/api/health/ready', req.url);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.ok;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const healthy = await isHealthy(req);
  if (!healthy) {
    return NextResponse.redirect(new URL('/maintenance', req.url));
  }

  const guard = GUARDS.find((re) => re.test(pathname));
  if (!guard) return NextResponse.next();


  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sid) {
    const next = encodeURIComponent(pathname + (search || ''));
    return NextResponse.redirect(new URL(`/auth/refresh?next=${next}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|maintenance|api/health).*)'],
};

