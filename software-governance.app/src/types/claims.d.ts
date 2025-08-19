import type {} from '@/server/auth/types'
import { DbUser } from "@/server/db/user-repo"

declare module '@/server/auth/types' {
  interface AppSessionClaims extends Omit<DbUser, 'password'> {}
}


