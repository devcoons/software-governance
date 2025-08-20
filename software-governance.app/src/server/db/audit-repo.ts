/* ---------------------------------------------------------------------- */
/* user-profile-repo.ts */
/* ---------------------------------------------------------------------- */

import {withTransaction } from '@/server/db/mysql-client'

/* ---------------------------------------------------------------------- */


export async function createAuditLog(
  userId: string | null,
  type: string,
  meta: Record<string, unknown> | null = null
) {
  if (!type) throw new Error('audit type is required')

  const metaJson = meta == null ? null : JSON.stringify(meta)

  return withTransaction(async (conn) => {
    // If userId is null/empty, store NULL; else store UUID (string) as BINARY(16)
    const sql = `
      INSERT INTO audit_log (user_id, type, meta)
      VALUES (
        CASE
          WHEN ? IS NULL OR ? = '' THEN NULL
          ELSE UNHEX(REPLACE(?, '-', ''))
        END,
        ?, 
        ?
      )
    `
    await conn.execute(sql, [userId, userId, userId, type, metaJson])
    return true
  })
}