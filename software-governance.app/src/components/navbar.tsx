import Link from 'next/link';
import type { Route } from 'next';
import NavLinksClient from '@/components/navbar/NavLinks.client';
import SubnavClient from '@/components/navbar/Subnav.client';

import { getSessionClaims } from '@/lib/authz'; // server-only
import MeLink from './navbar/MeLink.client';



type Role = 'admin' | 'user' | 'viewer';
type Subpage = { label: string; href: Route };
type MenuItem = { label: string; href: Route; subpages?: Subpage[] };

const BASE_ITEMS: MenuItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  {
    label: 'Software Registry',
    href: '/registry',
    subpages: [
      { label: 'Overview',         href: '/registry' },
      { label: 'New Entry',        href: '/registry/new' },
      { label: 'Pending Approval', href: '/registry/pending' },
    ],
  },
  { label: 'Approvals',  href: '/approvals' },
  { label: 'Compliance', href: '/compliance' },
  { label: 'Audit Logs', href: '/audit' },
] as const;

// Prefer admin > user > viewer
function pickEffectiveRole(roles: unknown): Role {
  const arr = Array.isArray(roles) ? (roles as string[]) : [];
  if (arr.includes('admin')) return 'admin';
  if (arr.includes('user')) return 'user';
  return 'viewer';
}

export default async function NavBar() {
  const claims = await getSessionClaims(); // server-side, from session cookie
  const role: Role = pickEffectiveRole(claims?.roles);

  // Build top-level menu synchronously on the server (no flicker)
  const withUsers: MenuItem[] =
    role === 'viewer'
      ? [...BASE_ITEMS]
      : [...BASE_ITEMS, { label: 'Users & Roles', href: '/users' }];

  // Role-based Users subnav (no client fetch)
  const usersSubpages: Subpage[] =
    role === 'admin'
      ? [
          { label: 'Overview',     href: '/users' },
          { label: 'Register New', href: '/users/register' },
        ]
      : role === 'user'
      ? [{ label: 'Overview', href: '/users' }]
      : [];

  const hasSubnav =
  (usersSubpages?.length ?? 0) > 0 ||
  withUsers.some(i => (i.subpages?.length ?? 0) > 0);

  return (
    <div className="bg-base-100 shadow-sm">
      <div className="navbar max-w-screen-xl mx-auto px-4 lg:px-8">
        {/* LEFT */}
        <div className="navbar-start">
          <Link href={'/dashboard'} className="btn btn-ghost text-xl">
            Software Governance
          </Link>
        </div>

        {/* CENTER - DESKTOP: active highlighting handled in client helper only */}
        <div className="navbar-center hidden lg:flex gap-2">
          <NavLinksClient items={withUsers} />
        </div>

        {/* RIGHT */}
        <div className="navbar-end gap-3">
         <MeLink />
          <form action="/api/logout" method="post">
            <button type="submit" className="btn btn-sm btn-outline">
              Logout
            </button>
          </form>
        </div>
      </div>

{/* SECONDARY NAV (desktop only, fixed height) */}
<div className="bg-base-200 border-t border-base-300 hidden lg:block">
  {/* Container mirrors the top bar width + fixed height to avoid page shift */}
  <div className="max-w-screen-xl mx-auto px-4 lg:px-8 h-12 flex items-center">
    {hasSubnav ? (
      <SubnavClient items={withUsers} usersSubpages={usersSubpages} />
    ) : (
      // Keep the same height even with no subpages
      <div aria-hidden className="w-full" />
    )}
  </div>
</div>

      {/* MOBILE DROPDOWN */}
      <div className="navbar lg:hidden border-t border-base-300 px-4">
        <details className="dropdown w-full">
          <summary className="btn btn-sm w-full">Menu</summary>
          <ul className="menu w-full bg-base-100 rounded-box mt-2">
            {/* Reuse the same client-side active logic for mobile */}
            <NavLinksClient items={withUsers} nestedUsersSubpages={usersSubpages} asList />
          </ul>
        </details>
      </div>
    </div>
  );
}
