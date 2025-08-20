/* ---------------------------------------------------------------------- */
/* Filepath: /src/libs/password.ts */
/* ---------------------------------------------------------------------- */

import config from '@/config'
import { z } from 'zod';
import { hash as aHash, verify as aVerify } from '@node-rs/argon2'

/* ---------------------------------------------------------------------- */

export const passwordSchema = z.string().min(10).refine((s) => {
	const lower = /[a-z]/.test(s);
	const upper = /[A-Z]/.test(s);
	const digit = /\d/.test(s);
	return lower && upper && digit;
}, { message: 'Password must be 10+ chars with upper, lower, and digit.' });

/* ---------------------------------------------------------------------- */

export function validatePasswordStrength(pw: string) {
	const r = passwordSchema.safeParse(pw);
	return r.success 
		? { ok: true as const } 
		: { ok: false as const, 
			error: r.error.issues[0]
				?.message 
				?? 'Weak password' };
}

/* ---------------------------------------------------------------------- */

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
	try {
		return await aVerify(hash, plain)
	} catch {
		return false
	}
}

/* ---------------------------------------------------------------------- */

export async function hashPassword(plain: string): Promise<string> {
	const opts = {
		memoryCost	: Number(config.ARGON2_MEMORY_KIB),
		timeCost	: Number(config.ARGON2_TIME_COST),
		parallelism	: Number(config.ARGON2_PARALLELISM),
		outputLen	: Number(config.ARGON2_HASH_LEN),
	}
	return aHash(plain, opts)
}

/* ---------------------------------------------------------------------- */

export function generatePassword(len = 14) {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';
	const arr = new Uint32Array(len);
	crypto.getRandomValues(arr);
	let out = '';
	for (let i = 0; i < len; i++) 
		out += alphabet[arr[i] % alphabet.length];
	return out;
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */