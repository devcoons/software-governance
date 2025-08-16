'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { Route } from 'next';

type Subpage = { label: string; href: Route };
type MenuItem = { label: string; href: Route; subpages?: Subpage[] };

export default function NavLinksClient({
  items,
  asList = false,
  nestedUsersSubpages,
}: {
  items: MenuItem[];
  asList?: boolean;                 // mobile mode renders <li>
  nestedUsersSubpages?: Subpage[];  // for "Users & Roles" (role-aware)
}) {
  const pathname = usePathname() ?? '/';
  const isActive = (href: Route) =>
    pathname === href || pathname.startsWith((href as string) + '/');

  if (asList) {
    // Mobile dropdown list rendering
    return (
      <>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={isActive(item.href) ? 'link link-primary' : ''}
            >
              {item.label}
            </Link>

            {/* Nested list for Users & Roles (role-aware) */}
            {item.label === 'Users & Roles' && nestedUsersSubpages?.length ? (
              <ul>
                {nestedUsersSubpages.map((sub) => (
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
            ) : null}

            {/* Nested list for sections that have static subpages (only when active) */}
            {item.label !== 'Users & Roles' && item.subpages && isActive(item.href) ? (
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
            ) : null}
          </li>
        ))}
      </>
    );
  }

  // Desktop top row buttons
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={clsx('btn btn-sm', isActive(item.href) ? 'btn-primary' : 'btn-ghost')}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
