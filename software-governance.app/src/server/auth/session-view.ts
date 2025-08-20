import { AppSessionClaims, SessionClaims } from "@/server/auth/types"

// src/auth/session-view.ts
export type SessionView = {
  userId: string
  claims?: SessionClaims
} | null
