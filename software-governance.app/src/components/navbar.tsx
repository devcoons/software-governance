'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

type MenuItem = {
  label: string;
  href: string;
  subpages?: { label: string; href: string }[];
};

const menuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
  },
  {
    label: 'Software Registry',
    href: '/registry',
    subpages: [
      { label: 'Overview', href: '/registry' },
      { label: 'New Entry', href: '/registry/new' },
      { label: 'Pending Approval', href: '/registry/pending' },
    ],
  },
  {
    label: 'Approvals',
    href: '/approvals',
  },
  {
    label: 'Compliance',
    href: '/compliance',
  },
  {
    label: 'Audit Logs',
    href: '/audit',
  },
  {
    label: 'Users & Roles',
    href: '/users',
  },
];

async function onLogout() {
  try { await fetch('/api/logout', { method: 'POST', cache: 'no-store' }); } catch {}
  window.location.replace('/auth/login');
}

const isSection = (pathname: string, base: string, allowedSubs: string[] = []) => {
  if (pathname === base) return true;
  return allowedSubs.some(sub => pathname === `${base}/${sub}`);
};

export default function NavBar() {
  const pathname = usePathname() || '/';
  const activeSection = menuItems.find((item) => isSection(pathname, item.href));

  return (
    <div className="bg-base-100 shadow-sm">
      <div className="navbar max-w-screen-xl mx-auto px-4 lg:px-8">

        {/* LEFT */}
        <div className="navbar-start">
          <Link href="/dashboard" className="btn btn-ghost text-xl">
            Software Governance
          </Link>
        </div>

        {/* CENTER - DESKTOP */}
        <div className="navbar-center hidden lg:flex gap-2">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'btn btn-sm',
                isSection(pathname, item.href) ? 'btn-primary' : 'btn-ghost'
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* RIGHT */}
        <div className="navbar-end gap-3">
          <Link
            href="/users/me"
            className={clsx(
              'btn btn-sm btn-circle',
              isSection(pathname, '/users/me') ? 'btn-primary' : ''
            )}
          >
            ID
          </Link>
          <form action="/api/logout" method="post">
            <button type="submit" className="btn btn-sm btn-outline">
              Logout
            </button>
          </form>
        </div>
      </div>

{/* SECONDARY NAV (desktop only) */}
<div className="bg-base-200 border-t border-base-300 hidden lg:block">
  <div className="max-w-screen-xl mx-auto px-4 lg:px-8 flex justify-center gap-2 py-2">
    {activeSection?.subpages?.length ? (
      activeSection.subpages.map((sub) => (
        <Link
          key={sub.href}
          href={sub.href}
          className={clsx(
            'px-3 py-1 rounded-full text-sm transition-colors',
            pathname === sub.href
              ? 'bg-primary text-primary-content font-semibold'
              : 'hover:bg-base-300'
          )}
        >
          {sub.label}
        </Link>
      ))
    ) : (
      <div className="h-[1.75rem]" /> 
    )}
  </div>
</div>


      {/* MOBILE DROPDOWN */}
      <div className="navbar lg:hidden border-t border-base-300 px-4">
        <details className="dropdown w-full">
          <summary className="btn btn-sm w-full">Menu</summary>
          <ul className="menu w-full bg-base-100 rounded-box mt-2">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={isSection(pathname, item.href) ? 'link link-primary' : ''}
                >
                  {item.label}
                </Link>
                {isSection(pathname, item.href) && item.subpages && (
                  <ul>
                    {item.subpages.map((sub) => (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          className={pathname === sub.href ? 'link link-primary' : ''}
                        >
                          {sub.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
