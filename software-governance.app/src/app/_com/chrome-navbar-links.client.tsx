/* ---------------------------------------------------------------------- */
/* Filepath: src/app/_com/chrome-navbar-links.client.tsx */
/* ---------------------------------------------------------------------- */

'use client';

/* ---------------------------------------------------------------------- */

import Link from 'next/link';
import clsx from 'clsx';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

/* ---------------------------------------------------------------------- */

type Subpage = 	{ label: string; href: Route };
type MenuItem = { label: string; href: Route; subpages?: Subpage[] };

/* ---------------------------------------------------------------------- */

export default function NavLinksClient({ items, asList = false, nestedUsersSubpages}
									: { items: MenuItem[]; asList?: boolean; nestedUsersSubpages?: Subpage[]; }) {
	const pathname = usePathname() ?? '/';
	const isActive = (href: Route) => pathname === href || pathname.startsWith((href as string) + '/');

	if (asList) {
		return (
		<>
        {items.map((item) => (
			<li key={item.href}>
				<Link href={item.href} className={isActive(item.href) ? 'link link-primary' : ''}>{item.label}</Link>
				{item.label === 'Users & Roles' && nestedUsersSubpages?.length ? (
					<ul>
						{nestedUsersSubpages.map((sub) => (
							<li key={sub.href}>
								<Link href={sub.href} className={pathname === sub.href ? 'link link-primary' : ''}>{sub.label}</Link>
							</li>
						))}
					</ul>
				) : null}

				{item.label !== 'Users & Roles' && item.subpages && isActive(item.href) ? (
					<ul>
						{item.subpages.map((sub) => (
							<li key={sub.href}>
								<Link href={sub.href} className={pathname === sub.href ? 'link link-primary' : ''}>{sub.label}</Link>
							</li>
						))}
					</ul>
				) : null}
			</li>
        ))}
		</>
		);
	}

	return (
    <>
		{items.map((item) => (
			<Link key={item.href} href={item.href} className={clsx('btn btn-sm', isActive(item.href) ? 'btn-primary' : 'btn-ghost')}>{item.label}</Link>
		))}
    </>
	);
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */