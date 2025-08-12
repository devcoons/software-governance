'use server';

import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/cookies';
import { sessionStore } from '@/lib/sstore.node';
import type { User } from '@/lib/repos/users.repo';
import * as usersRepo from '@/lib/repos/users.repo';

export type Role = 'admin' | 'user' | 'viewer';

export type SessionClaims = {
  userId?: string;
  email?: string;
  roles?: string[];
  [k: string]: unknown;
};

export async function getSessionClaims(): Promise<SessionClaims | null> {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  if (!sid) return null;
  const sess = await sessionStore.getSession(sid).catch(() => null);
  return (sess?.claims as SessionClaims) ?? null;
}

export async function requireRole(
  allowed: Role[]
): Promise<
  | { ok: true; claims: SessionClaims }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' }
> {
  const claims = await getSessionClaims();
  if (!claims) return { ok: false as const, reason: 'unauthenticated' };
  const roles: string[] = Array.isArray(claims.roles) ? claims.roles : [];
  const has = roles.some((r) => allowed.includes(r as Role));
  if (!has) return { ok: false as const, reason: 'forbidden' };
  return { ok: true as const, claims };
}

// Convenience guards (kept)
export async function requireUsersViewerBlocked() {
  // allow admin/user; block viewer
  return requireRole(['admin', 'user']);
}

export async function normalizeSingleRole(role: unknown): Promise<Role> {
  if (role === 'admin' || role === 'user' || role === 'viewer') return role;
  throw new Error('Invalid role');
}

/**
 * Require an authenticated user with the 'admin' role.
 * Returns the corresponding DB user with fields we need for authz decisions.
 */
export async function requireAdmin(): Promise<
  null | (Pick<User, 'id' | 'email' | 'totpEnabled'> & { roles: string[] })
> {
  const res = await requireRole(['admin']);
  if (!res.ok) return null;

  const claims = res.claims;
  const userId = claims.userId;
  const email = claims.email;

  let user: User | null = null;
  if (userId) {
    user = await usersRepo.getById(userId).catch(() => null);
  } else if (email) {
    user = await usersRepo.getByEmail(email).catch(() => null);
  }

  if (!user) return null;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (!roles.includes('admin')) return null;

  return { id: user.id, email: user.email, totpEnabled: user.totpEnabled, roles };
}
