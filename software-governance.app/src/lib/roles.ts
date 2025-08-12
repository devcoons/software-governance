export type Role = 'admin' | 'user' | 'viewer';

export function normalizeSingleRole(role: unknown): Role {
  if (role === 'admin' || role === 'user' || role === 'viewer') return role;
  throw new Error('Invalid role');
}

export function pickEffectiveRole(roles: unknown): Role {
  const arr = Array.isArray(roles) ? (roles as string[]) : [];
  if (arr.includes('admin')) return 'admin';
  if (arr.includes('user')) return 'user';
  return 'viewer';
}
