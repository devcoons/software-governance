import { exec } from '../db/core';
import { uuidToBin } from '../uuid';

export async function audit(type: string, meta: any = null, userId?: string) {
  await exec(
    `INSERT INTO audit_log (user_id, type, meta) VALUES (?, ?, ?)`,
    [userId ? uuidToBin(userId) : null, type, meta ? JSON.stringify(meta) : null],
  );
}
