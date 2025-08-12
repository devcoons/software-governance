import { authenticator } from 'otplib';
import { HashAlgorithms } from 'otplib/core';
import { query } from '@/lib/db/core';
import { uuidToBin } from '@/lib/uuid';
import { getTotpByUser } from './repos/totp.repo';

authenticator.resetOptions();

authenticator.options = {
  step: 30,
  digits: 6,
  algorithm: 'sha1' as HashAlgorithms,
  window: [1, 1],
};

export { authenticator };

/**
 * We assume a table `user_totp` with columns:
 *   user_id BINARY(16) PK, secret VARCHAR(64) NOT NULL
 * Adjust the query if your schema differs.
 */
async function getTotpSecret(userId: string): Promise<string | null> {
  const rows = await query<any[]>(
    `SELECT secret FROM user_totp WHERE user_id = ? LIMIT 1`,
    [uuidToBin(userId)]
  ).catch(() => []);
  if (!rows || rows.length === 0) return null;
  const secret = rows[0]?.secret as string | null;
  return secret ?? null;
}

/**
 * Verify a 6-digit TOTP code for the given user.
 * Returns false if the user has no secret or the code is invalid.
 */
export async function verifyTotpForUser(userId: string, token: string): Promise<boolean> {
  const rec = await getTotpByUser(userId);
  if (!rec) return false;
  // otplib accepts numeric string tokens; options already set globally.
  try {
    return authenticator.verify({  token:token, secret: rec.secret_b32 });
  } catch {
    return false;
  }
}
