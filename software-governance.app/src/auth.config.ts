// src/auth.config.ts
import './env';
import fs from 'fs';
import path from 'path';

function readSecretFromEnv(varName: string, fileVarName: string, fallback = ''): string {
  const v = process.env[varName];
  if (v && v.length > 0) return v;

  const file = process.env[fileVarName];
  if (!file) return fallback;

  // resolve relative to the env file directory first, then CWD as fallback
  const envDir = process.env.__ENV_DIR__ || process.cwd();
  const candidates = [
    path.isAbsolute(file) ? file : path.resolve(envDir, file),
    path.isAbsolute(file) ? file : path.resolve(process.cwd(), file),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const s = fs.readFileSync(p, 'utf8').trim();
        if (s) return s;
      }
    } catch { /* ignore and try next */ }
  }
  return fallback;
}

export const SESSION_COOKIE = process.env.SESSION_COOKIE || 'sid';
export const REFRESH_COOKIE = process.env.REFRESH_COOKIE || 'rid';

// TTLs in seconds
export const SESSION_TTL_SECONDS = parseInt(process.env.SESSION_TTL_SECONDS || '3600', 10); // 1 hour
export const REFRESH_TTL_SECONDS = parseInt(process.env.REFRESH_TTL_SECONDS || '2592000', 10); // 30 days

// Redis prefixes
export const SESSION_PREFIX = process.env.SESSION_PREFIX || 'sess:';
export const REFRESH_PREFIX = process.env.REFRESH_PREFIX || 'refresh:';
export const USER_SESSIONS_PREFIX = process.env.USER_SESSIONS_PREFIX || 'user:sess:';
export const USER_REFRESH_PREFIX = process.env.USER_REFRESH_PREFIX || 'user:refresh:';

export const DB_HOST = process.env.DB_HOST || '127.0.0.1';
export const DB_PORT = Number(process.env.DB_PORT || 3306);
export const DB_NAME = process.env.DB_NAME || 'sgov';
export const DB_USER = process.env.DB_USER || 'sgov';
export const DB_PASS = readSecretFromEnv('DB_PASS', 'DB_PASSWORD_FILE', '');

export const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
export const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
export const REDIS_USERNAME = process.env.REDIS_USERNAME || '';
export const REDIS_PASSWORD = readSecretFromEnv('REDIS_PASSWORD', 'REDIS_PASSWORD_FILE', '');

export const ARGON2_MEMORY_KIB  = Number(process.env.ARGON2_MEMORY_KIB  || 19456);
export const ARGON2_TIME_COST   = Number(process.env.ARGON2_TIME_COST   || 2);
export const ARGON2_PARALLELISM = Number(process.env.ARGON2_PARALLELISM || 1);
export const ARGON2_HASH_LEN    = Number(process.env.ARGON2_HASH_LEN    || 32);
export const ARGON2_SALT_LEN    = Number(process.env.ARGON2_SALT_LEN    || 16);

export const TOTP_ISSUER = process.env.TOTP_ISSUER || 'Software Governance';
