/* config.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import type { ConfigFlat } from './types/config-shape'

/* ---------------------------------------------------------------------- */

const config: ConfigFlat = Object.freeze({
  NODE_ENV: `development`,
  IS_PROD: false,
  APP_PORT: 3000,
  DB_HOST: `127.0.0.1`,
  DB_PORT: 13306,
  DB_NAME: `sgov`,
  DB_USER: `sgov`,
  DB_PASSWORD: `devpassword`,
  REDIS_HOST: `127.0.0.1`,
  REDIS_PORT: 16379,
  REDIS_USERNAME: ``,
  REDIS_PASSWORD: `devredis`,
  SESSION_COOKIE: `sid`,
  REFRESH_COOKIE: `rid`,
  SESSION_TTL_SECONDS: 30,
  REFRESH_IDLE_TTL_SECONDS: 2592000,
  REFRESH_ABSOLUTE_TTL_SECONDS: 7776000,
  SESSION_PREFIX: `sess:`,
  REFRESH_PREFIX: `rsh:`,
  USER_REFRESH_ZSET_PREFIX: `user:refreshz:`,
  USER_SESSIONS_PREFIX: `user:sessions:`,
  USER_REFRESH_PREFIX: `user:refresh:`,
  ARGON2_MEMORY_KIB: 19456,
  ARGON2_TIME_COST: 2,
  ARGON2_PARALLELISM: 1,
  ARGON2_HASH_LEN: 32,
  ARGON2_SALT_LEN: 16,
  LOGIN_WINDOW_SECONDS: 300,
  LOGIN_MAX_ATTEMPTS: 10,
  TOTP_ISSUER: `Software Governance`,
  HEALTH_CACHE_MS: 2000,
  COOKIE_SECURE: false,
  COOKIE_SAMESITE: `lax` as const,
  COOKIE_PATH: `/`,
  MAX_REFRESH_PER_USER: 5,
  BIND_UA: true,
  BIND_IP: true,
  ALLOW_EXACT: ["/","/favicon.ico"],
  ALLOW_PREFIXES: ["/api/health/","/maintenance","/login","/password-change","/forgot-password"],
  PROTECTED_PREFIXES: ["/dashboard","/users","/registry","/software","/approvals","/audit","/me","/auth/logout"],
  PASSWORD_MIN_SIZE: 10,
  FORGOT_PASS_RATE_LIMIT: 10,
  DEBUGGING: true,
  URL_PUBLIC: ["/forgot-password","/login","/maintenance","/forgot-reset","/health","/login","/logout","/session-bridge"],
  URL_PROTECTED: ["/approvals","/audit","/compliance","/dashboard","/logout","/me","/software/new","/software","/software/pending","/users","/users/register","/me/profile","/me/totp/enabled","/me/totp/setup","/me/totp/verify","/me/update-password","/users/change-role","/users/create","/users/delete","/users/profile","/users/reset-password"],
  URL_ADMIN: [],
})

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

export type { ConfigFlat } from './types/config-shape'
export default config
