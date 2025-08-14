/* claims.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import type { DbUser } from '@/server/db/user-repo'

/* ---------------------------------------------------------------------- */

export type SessionClaims = Omit<DbUser, 'password'>

/* ---------------------------------------------------------------------- */

export function claimsFromDbUser(u: DbUser): SessionClaims {
  const { password, ...rest } = u
  return { ...rest }
}
