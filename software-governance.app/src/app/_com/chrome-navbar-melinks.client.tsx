/* ---------------------------------------------------------------------- */
/* Filepath: src/app/_com/chrome-navbar-melinks.client.tsx */
/* ---------------------------------------------------------------------- */

'use client';

/* ---------------------------------------------------------------------- */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ---------------------------------------------------------------------- */

export default function MeLink() {
	const pathname = usePathname();
	const active = pathname === '/me' || pathname.startsWith('/me/');

	return (
    <Link href="/me" className={`btn btn-sm btn-circle ${active ? 'btn-primary' : ''}`} aria-label="My Account" aria-current={active ? 'page' : undefined}>ID</Link>
	);
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
