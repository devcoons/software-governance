import { query, exec } from '@/lib/db/core';
import { uuidToBin } from '@/lib/uuid';

export type UserTotpRow = {
  user_id: Buffer;      // BINARY(16)
  secret_b32: string;
  enrolled_at: Date;
};

export async function getTotpByUser(userId: string): Promise<UserTotpRow | null> {
  const rows = await query<UserTotpRow[]>(
    `SELECT user_id, secret_b32, enrolled_at
       FROM user_totp
      WHERE user_id = ? LIMIT 1`,
    [uuidToBin(userId)],
  );
  return rows[0] || null;
}

/**
 * If a pending secret exists (pre-verified), reuse it so the QR doesn’t change
 * between "Show QR" clicks. Otherwise create a fresh one.
 */
export async function upsertTotpSecret(userId: string, secretB32: string) {
  // MariaDB doesn't have INSERT ... ON DUP KEY UPDATE with BINARY PK issues; this is fine.
  await exec(
    `INSERT INTO user_totp (user_id, secret_b32)
         VALUES (?, ?)
     ON DUPLICATE KEY UPDATE secret_b32 = VALUES(secret_b32), enrolled_at = CURRENT_TIMESTAMP`,
    [uuidToBin(userId), secretB32],
  );
}

export async function deleteTotpForUser(userId: string) {
  await exec(`DELETE FROM user_totp WHERE user_id = ?`, [uuidToBin(userId)]);
}
