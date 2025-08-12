import { z } from 'zod';
import { hash, verify } from '@node-rs/argon2';
import {
  ARGON2_HASH_LEN, ARGON2_MEMORY_KIB, ARGON2_PARALLELISM,
  ARGON2_SALT_LEN, ARGON2_TIME_COST,
} from '@/auth.config';

export const passwordSchema = z.string().min(10).refine((s) => {
  const lower = /[a-z]/.test(s);
  const upper = /[A-Z]/.test(s);
  const digit = /\d/.test(s);
  return lower && upper && digit;
}, { message: 'Password must be 10+ chars with upper, lower, and digit.' });

export function validatePasswordStrength(pw: string) {
  const r = passwordSchema.safeParse(pw);
  return r.success ? { ok: true as const } : { ok: false as const, error: r.error.issues[0]?.message || 'Weak password' };
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    algorithm: 2, // argon2id
    memoryCost: ARGON2_MEMORY_KIB,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
    outputLen: ARGON2_HASH_LEN,
    salt: crypto.getRandomValues(new Uint8Array(ARGON2_SALT_LEN)),
  });
}

export async function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  try { return await verify(hashStr, plain); } catch { return false; }
}

export function generateTempPassword(len = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}