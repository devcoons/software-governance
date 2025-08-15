/* scripts/generate-config.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import fs from 'node:fs'
import path from 'node:path'
import * as dotenv from 'dotenv'

/* ---------------------------------------------------------------------- */

type SameSite = 'lax' | 'strict' | 'none'

/* ---------------------------------------------------------------------- */

function asInt(name: string, v: unknown, def: number, min?: number): number {
  const n = Number(v ?? def)
  if (!Number.isFinite(n)) throw new Error(`Invalid integer for ${name}`)
  if (min != null && n < min) throw new Error(`Invalid ${name}: must be >= ${min}`)
  return n
}

/* ---------------------------------------------------------------------- */

function asBool(v: unknown, def = false): boolean {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes') return true
  if (s === 'false' || s === '0' || s === 'no') return false
  return def
}

/* ---------------------------------------------------------------------- */

function sameSite(v: unknown, def: SameSite = 'lax'): SameSite {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'lax' || s === 'strict' || s === 'none') return s as SameSite
  return def
}

/* ---------------------------------------------------------------------- */

function loadEnvCascade(): string {
  const env = process.env.NODE_ENV || 'development'
  const dirs = [process.cwd(), path.resolve(process.cwd(), '..')]
  const files = [
    `.env.${env}.local`,
    `.env.local`,
    `.env.${env}`,
    `.env`,
  ]
  let usedDir = ''
  for (const dir of dirs) {
    for (const file of files) {
      const p = path.resolve(dir, file)
      if (!fs.existsSync(p)) continue
      dotenv.config({ path: p, override: false })
      if (!usedDir) usedDir = dir
    }
  }
  return usedDir || process.cwd()
}

/* ---------------------------------------------------------------------- */

function resolveSecretPath(filePath: string | undefined | null, envDir: string): string | null {
  if (!filePath) return null
  const norm = String(filePath).replace(/^[.][/\\]/, '')
  const candidates = [
    path.isAbsolute(filePath) ? filePath : path.resolve(envDir, filePath),
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), norm),
    process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD, filePath) : '',
    process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD, norm) : '',
  ].filter(Boolean) as string[]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {}
  }
  return null
}

/* ---------------------------------------------------------------------- */

function readSecret(vars: string[], fileVars: string[], envDir: string, fallback = ''): string {
  for (const k of vars) {
    const v = process.env[k]
    if (v && v.length > 0) return v
  }
  for (const fk of fileVars) {
    const f = process.env[fk]
    const abs = resolveSecretPath(f, envDir)
    if (!abs) continue
    try {
      const data = fs.readFileSync(abs, 'utf8').trim()
      if (data) return data
    } catch {}
  }
  return fallback
}

/* ---------------------------------------------------------------------- */

function esc(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\`')
}

/* ---------------------------------------------------------------------- */

type Collected = ReturnType<typeof collectValues>

/* ---------------------------------------------------------------------- */

function collectValues() {
  const envDir = loadEnvCascade()

  const NODE_ENV = process.env.NODE_ENV || 'development'
  const IS_PROD = NODE_ENV === 'production'

  const APP_PORT = asInt('APP_PORT', process.env.APP_PORT ?? 3000, 3000, 0)

  const DB_HOST = process.env.DB_HOST || '127.0.0.1'
  const DB_PORT = asInt('DB_PORT', process.env.DB_PORT ?? 13306, 13306, 1)
  const DB_NAME = process.env.DB_NAME || 'sgov'
  const DB_USER = process.env.DB_USER || 'sgov'
  const DB_PASSWORD = readSecret(
    ['DB_PASS', 'DB_PASSWORD', 'MYSQL_PASSWORD'],
    ['DB_PASSWORD_FILE', 'MYSQL_PASSWORD_FILE'],
    envDir,
    ''
  )

  const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1'
  const REDIS_PORT = asInt('REDIS_PORT', process.env.REDIS_PORT ?? 16379, 16379, 1)
  const REDIS_USERNAME = process.env.REDIS_USERNAME || ''
  const REDIS_PASSWORD = readSecret(
    ['REDIS_PASSWORD'],
    ['REDIS_PASSWORD_FILE'],
    envDir,
    ''
  )

  const SESSION_COOKIE = process.env.SESSION_COOKIE || (IS_PROD ? '__Host-sid' : 'sid')
  const REFRESH_COOKIE = process.env.REFRESH_COOKIE || (IS_PROD ? '__Host-rid' : 'rid')

  const SESSION_TTL_SECONDS = asInt('SESSION_TTL_SECONDS', process.env.SESSION_TTL_SECONDS ?? 1800, 1800, 60)
  const REFRESH_IDLE_TTL_SECONDS = asInt('REFRESH_IDLE_TTL_SECONDS', process.env.REFRESH_IDLE_TTL_SECONDS ?? 2592000, 2592000, 3600)
  const REFRESH_ABSOLUTE_TTL_SECONDS = asInt('REFRESH_ABSOLUTE_TTL_SECONDS', process.env.REFRESH_ABSOLUTE_TTL_SECONDS ?? 7776000, 7776000, 86400)

  const SESSION_PREFIX = process.env.SESSION_PREFIX || 'sess:'
  const REFRESH_PREFIX = process.env.REFRESH_PREFIX || 'rsh:'
  const USER_SESSIONS_PREFIX = process.env.USER_SESSIONS_PREFIX || 'user:sessions:'
  const USER_REFRESH_PREFIX = process.env.USER_REFRESH_PREFIX || 'user:refresh:'

  const ARGON2_MEMORY_KIB = asInt('ARGON2_MEMORY_KIB', process.env.ARGON2_MEMORY_KIB ?? 19456, 19456, 4096)
  const ARGON2_TIME_COST = asInt('ARGON2_TIME_COST', process.env.ARGON2_TIME_COST ?? 2, 2, 1)
  const ARGON2_PARALLELISM = asInt('ARGON2_PARALLELISM', process.env.ARGON2_PARALLELISM ?? 1, 1, 1)
  const ARGON2_HASH_LEN = asInt('ARGON2_HASH_LEN', process.env.ARGON2_HASH_LEN ?? 32, 32, 16)
  const ARGON2_SALT_LEN = asInt('ARGON2_SALT_LEN', process.env.ARGON2_SALT_LEN ?? 16, 16, 8)

  const PASSWORD_MIN_SIZE = asInt('PASSWORD_MIN_SIZE', process.env.PASSWORD_MIN_SIZE ?? 10, 10, 1)

  const FORGOT_PASS_RATE_LIMIT = asInt('FORGOT_PASS_RATE_LIMIT', process.env.PASSWORD_MIN_SIZE ?? 10, 10, 1)

  const LOGIN_WINDOW_SECONDS = asInt('LOGIN_WINDOW_SECONDS', process.env.LOGIN_WINDOW_SECONDS ?? 300, 300, 30)
  const LOGIN_MAX_ATTEMPTS = asInt('LOGIN_MAX_ATTEMPTS', process.env.LOGIN_MAX_ATTEMPTS ?? 10, 10, 1)

  const TOTP_ISSUER = process.env.TOTP_ISSUER || 'Software Governance'
  const HEALTH_CACHE_MS = asInt('HEALTH_CACHE_MS', process.env.HEALTH_CACHE_MS ?? 2000, 2000, 500)

  const COOKIE_SECURE = asBool(process.env.COOKIE_SECURE, IS_PROD)
  const COOKIE_SAMESITE = sameSite(process.env.COOKIE_SAMESITE, 'lax')
  const COOKIE_PATH = process.env.COOKIE_PATH || '/'

  const MAX_REFRESH_PER_USER = asInt('MAX_REFRESH_PER_USER', process.env.MAX_REFRESH_PER_USER ?? 5, 5, 1)
  const BIND_UA = asBool(process.env.BIND_UA, true)
  const BIND_IP = asBool(process.env.BIND_IP, true)

  const ALLOW_EXACT = ['/', '/favicon.ico']
const ALLOW_PREFIXES = [
  '/api/health/',
  '/api/auth/',
  '/maintenance',
  '/login',
  '/auth/password-change',
  '/auth/forgot',
]

  const PROTECTED_PREFIXES = [
    '/dashboard',
    '/users',
    '/software',
    '/approvals',
    '/audit',
    '/me',
    '/logout',
  ]

  return {
    NODE_ENV,
    IS_PROD,
    APP_PORT,
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_USERNAME,
    REDIS_PASSWORD,
    SESSION_COOKIE,
    REFRESH_COOKIE,
    SESSION_TTL_SECONDS,
    REFRESH_IDLE_TTL_SECONDS,
    REFRESH_ABSOLUTE_TTL_SECONDS,
    SESSION_PREFIX,
    REFRESH_PREFIX,
    USER_SESSIONS_PREFIX,
    USER_REFRESH_PREFIX,
    ARGON2_MEMORY_KIB,
    ARGON2_TIME_COST,
    ARGON2_PARALLELISM,
    ARGON2_HASH_LEN,
    ARGON2_SALT_LEN,
    LOGIN_WINDOW_SECONDS,
    LOGIN_MAX_ATTEMPTS,
    TOTP_ISSUER,
    HEALTH_CACHE_MS,
    COOKIE_SECURE,
    COOKIE_SAMESITE,
    COOKIE_PATH,
    MAX_REFRESH_PER_USER,
    BIND_UA,
    BIND_IP,
    ALLOW_EXACT,
    ALLOW_PREFIXES,
    PROTECTED_PREFIXES,
    PASSWORD_MIN_SIZE,
    FORGOT_PASS_RATE_LIMIT,
  }
}

/* ---------------------------------------------------------------------- */

function emitServer(values: Collected): string {
  const v = values
  return `/* config.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import type { ConfigFlat } from './types/config-shape'

/* ---------------------------------------------------------------------- */

const config: ConfigFlat = Object.freeze({
  NODE_ENV: \`${esc(v.NODE_ENV)}\`,
  IS_PROD: ${v.IS_PROD},
  APP_PORT: ${v.APP_PORT},
  DB_HOST: \`${esc(v.DB_HOST)}\`,
  DB_PORT: ${v.DB_PORT},
  DB_NAME: \`${esc(v.DB_NAME)}\`,
  DB_USER: \`${esc(v.DB_USER)}\`,
  DB_PASSWORD: \`${esc(v.DB_PASSWORD)}\`,
  REDIS_HOST: \`${esc(v.REDIS_HOST)}\`,
  REDIS_PORT: ${v.REDIS_PORT},
  REDIS_USERNAME: \`${esc(v.REDIS_USERNAME)}\`,
  REDIS_PASSWORD: \`${esc(v.REDIS_PASSWORD)}\`,
  SESSION_COOKIE: \`${esc(v.SESSION_COOKIE)}\`,
  REFRESH_COOKIE: \`${esc(v.REFRESH_COOKIE)}\`,
  SESSION_TTL_SECONDS: ${v.SESSION_TTL_SECONDS},
  REFRESH_IDLE_TTL_SECONDS: ${v.REFRESH_IDLE_TTL_SECONDS},
  REFRESH_ABSOLUTE_TTL_SECONDS: ${v.REFRESH_ABSOLUTE_TTL_SECONDS},
  SESSION_PREFIX: \`${esc(v.SESSION_PREFIX)}\`,
  REFRESH_PREFIX: \`${esc(v.REFRESH_PREFIX)}\`,
  USER_SESSIONS_PREFIX: \`${esc(v.USER_SESSIONS_PREFIX)}\`,
  USER_REFRESH_PREFIX: \`${esc(v.USER_REFRESH_PREFIX)}\`,
  ARGON2_MEMORY_KIB: ${v.ARGON2_MEMORY_KIB},
  ARGON2_TIME_COST: ${v.ARGON2_TIME_COST},
  ARGON2_PARALLELISM: ${v.ARGON2_PARALLELISM},
  ARGON2_HASH_LEN: ${v.ARGON2_HASH_LEN},
  ARGON2_SALT_LEN: ${v.ARGON2_SALT_LEN},
  LOGIN_WINDOW_SECONDS: ${v.LOGIN_WINDOW_SECONDS},
  LOGIN_MAX_ATTEMPTS: ${v.LOGIN_MAX_ATTEMPTS},
  TOTP_ISSUER: \`${esc(v.TOTP_ISSUER)}\`,
  HEALTH_CACHE_MS: ${v.HEALTH_CACHE_MS},
  COOKIE_SECURE: ${v.COOKIE_SECURE},
  COOKIE_SAMESITE: \`${esc(v.COOKIE_SAMESITE)}\` as const,
  COOKIE_PATH: \`${esc(v.COOKIE_PATH)}\`,
  MAX_REFRESH_PER_USER: ${v.MAX_REFRESH_PER_USER},
  BIND_UA: ${v.BIND_UA},
  BIND_IP: ${v.BIND_IP},
  ALLOW_EXACT: ${JSON.stringify(v.ALLOW_EXACT)},
  ALLOW_PREFIXES: ${JSON.stringify(v.ALLOW_PREFIXES)},
  PROTECTED_PREFIXES: ${JSON.stringify(v.PROTECTED_PREFIXES)},
  PASSWORD_MIN_SIZE: ${v.PASSWORD_MIN_SIZE},
  FORGOT_PASS_RATE_LIMIT: ${v.FORGOT_PASS_RATE_LIMIT},
})

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

export type { ConfigFlat } from './types/config-shape'
export default config
`
}

/* ---------------------------------------------------------------------- */

function emitEdge(values: Collected): string {
  const v = values
  return `/* config.e.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import type { ConfigFlat } from './types/config-shape'

/* ---------------------------------------------------------------------- */

const config: ConfigFlat = Object.freeze({
  NODE_ENV: \`${esc(v.NODE_ENV)}\`,
  IS_PROD: ${v.IS_PROD},
  APP_PORT: ${v.APP_PORT},
  DB_HOST: \`\`,
  DB_PORT: 0,
  DB_NAME: \`\`,
  DB_USER: \`\`,
  DB_PASSWORD: \`\`,
  REDIS_HOST: \`\`,
  REDIS_PORT: 0,
  REDIS_USERNAME: \`\`,
  REDIS_PASSWORD: \`\`,
  SESSION_COOKIE: \`${esc(v.SESSION_COOKIE)}\`,
  REFRESH_COOKIE: \`${esc(v.REFRESH_COOKIE)}\`,
  SESSION_TTL_SECONDS: ${v.SESSION_TTL_SECONDS},
  REFRESH_IDLE_TTL_SECONDS: ${v.REFRESH_IDLE_TTL_SECONDS},
  REFRESH_ABSOLUTE_TTL_SECONDS: ${v.REFRESH_ABSOLUTE_TTL_SECONDS},
  SESSION_PREFIX: \`${esc(v.SESSION_PREFIX)}\`,
  REFRESH_PREFIX: \`${esc(v.REFRESH_PREFIX)}\`,
  USER_SESSIONS_PREFIX: \`${esc(v.USER_SESSIONS_PREFIX)}\`,
  USER_REFRESH_PREFIX: \`${esc(v.USER_REFRESH_PREFIX)}\`,
  ARGON2_MEMORY_KIB: ${v.ARGON2_MEMORY_KIB},
  ARGON2_TIME_COST: ${v.ARGON2_TIME_COST},
  ARGON2_PARALLELISM: ${v.ARGON2_PARALLELISM},
  ARGON2_HASH_LEN: ${v.ARGON2_HASH_LEN},
  ARGON2_SALT_LEN: ${v.ARGON2_SALT_LEN},
  LOGIN_WINDOW_SECONDS: ${v.LOGIN_WINDOW_SECONDS},
  LOGIN_MAX_ATTEMPTS: ${v.LOGIN_MAX_ATTEMPTS},
  TOTP_ISSUER: \`${esc(v.TOTP_ISSUER)}\`,
  HEALTH_CACHE_MS: ${v.HEALTH_CACHE_MS},
  COOKIE_SECURE: ${v.COOKIE_SECURE},
  COOKIE_SAMESITE: \`${esc(v.COOKIE_SAMESITE)}\` as const,
  COOKIE_PATH: \`${esc(v.COOKIE_PATH)}\`,
  MAX_REFRESH_PER_USER: ${v.MAX_REFRESH_PER_USER},
  BIND_UA: ${v.BIND_UA},
  BIND_IP: ${v.BIND_IP},
  ALLOW_EXACT: ${JSON.stringify(v.ALLOW_EXACT)},
  ALLOW_PREFIXES: ${JSON.stringify(v.ALLOW_PREFIXES)},
  PROTECTED_PREFIXES: ${JSON.stringify(v.PROTECTED_PREFIXES)},
  PASSWORD_MIN_SIZE: ${v.PASSWORD_MIN_SIZE},
  FORGOT_PASS_RATE_LIMIT: ${v.FORGOT_PASS_RATE_LIMIT},
})

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

export type { ConfigFlat } from './types/config-shape'
export default config
`
}

/* ---------------------------------------------------------------------- */

function writeFile(relPath: string, content: string) {
  const outFile = path.resolve(process.cwd(), relPath)
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, content, 'utf8')
  process.stdout.write(`wrote ${path.relative(process.cwd(), outFile)}\n`)
}

/* ---------------------------------------------------------------------- */

function ensureTypeFile() {
  const rel = 'src/types/config-shape.ts'
  const outFile = path.resolve(process.cwd(), rel)

  const content = `/* config-shape.ts */
/* ---------------------------------------------------------------------- */
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
}>
`
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, content, 'utf8')
  process.stdout.write(`wrote ${rel}\n`)
}

/* ---------------------------------------------------------------------- */

function main() {
  ensureTypeFile()
  const values = collectValues()
  writeFile('src/config.ts', emitServer(values))
  writeFile('src/config.e.ts', emitEdge(values))
}

/* ---------------------------------------------------------------------- */

main()
