/* ---------------------------------------------------------------------- */
/* config-shape.ts */
/* ---------------------------------------------------------------------- */


export type ConfigFlat = Readonly<{
  NODE_ENV: string
  IS_PROD: boolean
  APP_PORT: number
  DB_HOST: string
  DB_PORT: number
  DB_NAME: string
  DB_USER: string
  DB_PASSWORD: string
  REDIS_HOST: string
  REDIS_PORT: number
  REDIS_USERNAME: string
  REDIS_PASSWORD: string
  SESSION_COOKIE: string
  REFRESH_COOKIE: string
  SESSION_TTL_SECONDS: number
  REFRESH_IDLE_TTL_SECONDS: number
  REFRESH_ABSOLUTE_TTL_SECONDS: number
  SESSION_PREFIX: string
  REFRESH_PREFIX: string
  USER_REFRESH_ZSET_PREFIX: string
  USER_SESSIONS_PREFIX: string
  USER_REFRESH_PREFIX: string
  ARGON2_MEMORY_KIB: number
  ARGON2_TIME_COST: number
  ARGON2_PARALLELISM: number
  ARGON2_HASH_LEN: number
  ARGON2_SALT_LEN: number
  LOGIN_WINDOW_SECONDS: number
  LOGIN_MAX_ATTEMPTS: number
  TOTP_ISSUER: string
  HEALTH_CACHE_MS: number
  COOKIE_SECURE: boolean
  COOKIE_SAMESITE: 'lax' | 'strict' | 'none'
  COOKIE_PATH: string
  MAX_REFRESH_PER_USER: number
  BIND_UA: boolean
  BIND_IP: boolean
  ALLOW_EXACT: string[]
  ALLOW_PREFIXES: string[]
  PROTECTED_PREFIXES: string[]
  PASSWORD_MIN_SIZE: number
  FORGOT_PASS_RATE_LIMIT: number
  DEBUGGING: boolean
  URL_PUBLIC: string[]
  URL_PROTECTED: string[]
  URL_ADMIN: string[]
}>

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */