  import { getSessionOrBridge } from '@/server/auth/ctx';
import { SessionRecord } from '@/server/auth/types';
  
  export function toSessionView(s: Awaited<ReturnType<typeof getSessionOrBridge>>) {
    if (!s) return null
    return {
      userId: s.user_id,
      claims: s.claims,
    }
  }


  type MatchMode = 'any' | 'all'

type CheckOpts = {
  mode?: MatchMode
  caseSensitive?: boolean
}

/* ---------------------------------------------------------------------- */

function normalizeList(input: string[] | string, caseSensitive: boolean): string[] {
  const arr = Array.isArray(input) ? input : [input]
  return caseSensitive ? arr.map(String) : arr.map(s => String(s).toLowerCase())
}

/* ---------------------------------------------------------------------- */

function claimsList(sess: SessionRecord | null | undefined, key: 'roles' | 'permissions', caseSensitive: boolean): string[] {
    const claims = (sess?.claims ?? {}) as Record<string, unknown>;
    const raw = claims[key];
  if (!Array.isArray(raw)) return []
  return normalizeList(raw, caseSensitive)
}

/* ---------------------------------------------------------------------- */

function hasList(
  have: string[],
  want: string[] | string,
  opts?: CheckOpts
): boolean {
  const mode: MatchMode = opts?.mode ?? 'any'
  const caseSensitive = opts?.caseSensitive ?? false
  const wantNorm = normalizeList(want, caseSensitive)
  if (wantNorm.length === 0 || have.length === 0) return false
  const set = new Set(have)
  if (mode === 'all') {
    for (const w of wantNorm) if (!set.has(w)) return false
    return true
  }
  for (const w of wantNorm) if (set.has(w)) return true
  return false
}

/* ---------------------------------------------------------------------- */

export function hasRoles(
  sess: SessionRecord | null | undefined,
  roles: string[] | string,
  opts?: CheckOpts
): boolean {
  const caseSensitive = opts?.caseSensitive ?? false
  const have = claimsList(sess, 'roles', caseSensitive)
  return hasList(have, roles, opts)
}

/* ---------------------------------------------------------------------- */

export function hasPermissions(
  sess: SessionRecord | null | undefined,
  perms: string[] | string,
  opts?: CheckOpts
): boolean {
  const caseSensitive = opts?.caseSensitive ?? false
  const have = claimsList(sess, 'permissions', caseSensitive)
  return hasList(have, perms, opts)
}

/* ---------------------------------------------------------------------- */

export function getStringClaim(claims: unknown, key: string): string | undefined {
  if (typeof claims !== 'object' || claims === null) return undefined;
  const v = (claims as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : undefined;
}

/* ---------------------------------------------------------------------- */

export function getIntClaim(claims: unknown, key: string): number | undefined {
  if (typeof claims !== 'object' || claims === null) 
    return undefined;
  const v = (claims as Record<string, unknown>)[key];
  console.log("INT_CLAIMS",v)
  return typeof v === 'number' ? v : undefined;
}

/* ---------------------------------------------------------------------- */

export function getBoolClaim(claims: unknown, key: string): boolean | undefined {
  if (typeof claims !== 'object' || claims === null) 
    return undefined;
  const v = (claims as Record<string, unknown>)[key];
  console.log("BOOL_CLAIMS",v)
  return typeof v === 'boolean' ? v : undefined;
}
/* ---------------------------------------------------------------------- */

export function getStringArrayClaim(claims: unknown, key: string): string[] {
  if (typeof claims !== 'object' || claims === null) return [];
  const v = (claims as Record<string, unknown>)[key];
  if (Array.isArray(v)) {
    // Allow string arrays; coerce other element types to strings defensively
    return v.filter(x => typeof x === 'string') as string[];
  }
  // Some backends encode arrays as comma-separated strings; accept that too
  if (typeof v === 'string') {
    const arr = v.split(',').map(s => s.trim()).filter(Boolean);
    return arr;
  }
  return [];
}