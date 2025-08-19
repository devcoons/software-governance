import { AppSessionClaims } from "@/server/auth/types"

// src/auth/session-view.ts
export type SessionView = {
  userId: string
  claims?: AppSessionClaims
} | null
