import { exec } from '../db/core';
import { uuidToBin } from '../uuid';



export async function audit(userId: string | null, type: string, meta: any = null) {
  if (userId) {
    await exec(
      `INSERT INTO audit_log (user_id, type, meta) VALUES (?, ?, ?)`,
      [uuidToBin(userId), type, meta ? JSON.stringify(meta) : null],
    );
  } else {
    await exec(
      `INSERT INTO audit_log (user_id, type, meta) VALUES (NULL, ?, ?)`,
      [type, meta ? JSON.stringify(meta) : null],
    );
  }
}