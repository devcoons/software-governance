/* ---------------------------------------------------------------------- */
/* Filepath: src/app/_com/chrome-navbar-sublinks.client.tsx */
/* ---------------------------------------------------------------------- */

'use client';

/* ---------------------------------------------------------------------- */

import clsx from 'clsx';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

/* ---------------------------------------------------------------------- */

type Subpage = 	{ label: string; href: Route };
type MenuItem = { label: string; href: Route; subpages?: Subpage[] };

/* ---------------------------------------------------------------------- */

export default function SubnavClient({ items, usersSubpages, }
						: {items: MenuItem[]; usersSubpages: Subpage[]; }) {
							
	const pathname = usePathname() || '/';
	const isActive = (href: Route) => pathname === href || pathname.startsWith((href as string) + '/');

	const activeSection = items.find((i) => isActive(i.href));
	if (!activeSection) 
		return <div className="h-[1.75rem]" />;

	if (activeSection.label === 'Users & Roles') {
		if (!usersSubpages.length) 
			return <div className="h-[1.75rem]" />;
		
		return (
		<div className="max-w-screen-xl mx-auto px-4 lg:px-8 flex justify-center gap-2 py-2">
			{usersSubpages.map((sub) => (
				<Link key={sub.href} href={sub.href} 
					className={clsx(
					'px-3 py-1 rounded-full text-sm transition-colors',
					pathname === sub.href
						? 'bg-primary text-primary-content font-semibold'
						: 'hover:bg-base-300'
					)}
				>{sub.label}</Link>
			))}
		</div>
		);
	}

	if (activeSection.subpages?.length) {
		return (
		<div className="max-w-screen-xl mx-auto px-4 lg:px-8 flex justify-center gap-2 py-2">
			{activeSection.subpages.map((sub) => (
				<Link key={sub.href} href={sub.href}
					className={clsx(
					'px-3 py-1 rounded-full text-sm transition-colors',
					pathname === sub.href
						? 'bg-primary text-primary-content font-semibold'
						: 'hover:bg-base-300'
					)}
				>{sub.label}</Link>
			))}
		</div>
		);
	}

	return <div className="h-[1.75rem]" />;
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
