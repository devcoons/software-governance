/* ---------------------------------------------------------------------- */
/* Filepath: src/app/_com/chrome-navbar.tsx */
/* ---------------------------------------------------------------------- */

import Link from 'next/link';
import type { Route } from 'next';
import NavLinksClient from './chrome-navbar-links.client'
import SubnavClient from './chrome-navbar-sublinks.client'
import MeLink from './chrome-navbar-melinks.client'
import { SessionView } from '@/server/auth/session-view';


/* ---------------------------------------------------------------------- */

type Role = 'admin' | 'user' | 'viewer';
type Subpage = { label: string; href: Route };
type MenuItem = { label: string; href: Route; subpages?: Subpage[] };

/* ---------------------------------------------------------------------- */

const BASE_ITEMS: MenuItem[] = [
	{ 	label: 'Dashboard', 		href: '/dashboard' },
	{ 	label: 'Software Registry', href: '/software',
		subpages: [
		{ 	label: 'Overview',         href: '/software' },
		{ 	label: 'New Entry',        href: '/software/new' },
		{ 	label: 'Pending Approval', href: '/software/pending' },
		],
	},
	{ 	label: 'Approvals',  href: '/approvals' },
	{ 	label: 'Compliance', href: '/compliance' },
	{ 	label: 'Audit Logs', href: '/audit' },
] as const;

/* ---------------------------------------------------------------------- */

function pickEffectiveRole(roles: unknown): Role {
	const arr = Array.isArray(roles) ? (roles as string[]) : [];
	if (arr.includes('admin')) return 'admin';
	if (arr.includes('user')) return 'user';
	return 'viewer';
}

/* ---------------------------------------------------------------------- */

function getStringArrayClaim<T extends string>(claims: unknown, key: string): T[] {
  if (typeof claims !== 'object' || claims === null) return [];
  const v = (claims as Record<string, unknown>)[key];

  if (Array.isArray(v)) {
    // keep only strings; coerce to T[]
    return v.filter((x): x is T => typeof x === 'string');
  }

  if (typeof v === 'string') {
    // also support comma-separated strings from older backends
    return v.split(',').map(s => s.trim()).filter(Boolean) as T[];
  }

  return [];
}

/* ---------------------------------------------------------------------- */

export default async function NavBar({ session }: { session: SessionView }) {

    
	const roles = getStringArrayClaim<Role>(session?.claims, 'roles');
    const role: Role = pickEffectiveRole(roles);

	const withUsers: MenuItem[] = role === 'viewer'
			? [...BASE_ITEMS]
			: [...BASE_ITEMS, { label: 'Users & Roles', href: '/users' }];

	const usersSubpages: Subpage[] = role === 'admin'
			? [
				{ label: 'Overview',     href: '/users' },
				{ label: 'Register New', href: '/users/register' },
			  ]
			: role === 'user'
			? [{ label: 'Overview', href: '/users' }]
			: [];

	const hasSubnav = (usersSubpages?.length ?? 0) > 0 
					|| withUsers.some(i => (i.subpages?.length ?? 0) > 0);

	return (
    <div className="bg-base-100 shadow-sm">
		<div className="navbar max-w-screen-2xl mx-auto px-4 lg:px-8">
			<div className="navbar-start">
				<Link href={'/dashboard'} className="btn btn-ghost text-xl">Software Governance</Link>
			</div>

			<div className="navbar-center hidden lg:flex gap-2">
				<NavLinksClient items={withUsers} />
			</div>

			<div className="navbar-end gap-3">
				<MeLink />
				<form action="/logout" method="post">
					<button type="submit" className="btn btn-sm btn-outline">Logout</button>
				</form>
			</div>
		</div>

		<div className="bg-base-200 border-t border-base-300 hidden lg:block">
			<div className="max-w-screen-xl mx-auto px-4 lg:px-8 h-12 flex items-center">
				{ hasSubnav ? ( <SubnavClient items={withUsers} usersSubpages={usersSubpages} /> ) 
							: ( <div aria-hidden className="w-full" /> )
				}
			</div>
		</div>

		<div className="navbar lg:hidden border-t border-base-300 px-4">
			<details className="dropdown w-full">
				<summary className="btn btn-sm w-full">Menu</summary>
				<ul className="menu w-full bg-base-100 rounded-box mt-2">
					<NavLinksClient items={withUsers} nestedUsersSubpages={usersSubpages} asList />
				</ul>
			</details>
		</div>
    </div>
	);
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */