/* ---------------------------------------------------------------------- */
/* Filepath: src/types/provider.ts */
/* ---------------------------------------------------------------------- */

import { getSessionOrBridge } from "@/server/auth/ctx"
import { AppSessionClaims } from "@/server/auth/types"
import { DbUser } from "@/server/db/user-repo"

/* ---------------------------------------------------------------------- */

export type CookieSpec = {
	name	: string
	value	: string
	options?: {
		httpOnly?	: boolean
		secure?		: boolean
		sameSite?	: 'lax' | 'strict' | 'none'
		path?		: string
		domain?		: string
		maxAge?		: number
		expires?	: Date
	}
}

/* ---------------------------------------------------------------------- */

export type HealthProbe = {
    ok: boolean
    db: { ok: boolean; details?: string }
    redis: { ok: boolean; details?: string }
    ts: number
}

/* ---------------------------------------------------------------------- */

export type LoginInput = {
  login: string
  password: string
  rememberMe: boolean
}

export type ServiceResult =
  | { ok: true }
  | { ok: false; error: "invalid_totp" | "weak_password" | "rate_limited" | "not_allowed" | "unknown" };

/* ---------------------------------------------------------------------- */

export type LoginResult =
  | { ok: true; sid: string; rid: string; rememberMe: boolean; forcePasswordChange: boolean }
  | { ok: false; error: string }
/* ---------------------------------------------------------------------- */

  export function claimsFromDbUser(u: DbUser): AppSessionClaims {
    const { password, ...rest } = u
    return { ...rest }
  }


