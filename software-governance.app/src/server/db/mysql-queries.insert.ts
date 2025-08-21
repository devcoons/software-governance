/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/db/mysql-queries.insert.ts */
/* ---------------------------------------------------------------------- */

import { randomUUID } from "crypto";
import { exec, withTransaction } from "./mysql-client";
import { getErrorCode } from "./mysql-utils";
import { generatePassword, hashPassword } from "@/libs/password";
import { UserProfile } from "./mysql-types";
import { readUserProfile } from "./mysql-queries.select";

/* ---------------------------------------------------------------------- */

export async function createAuditLog(userId: string | null, type: string, meta: Record<string, unknown> | null = null) {
    if (!type) 
        throw new Error('audit type is required')

    const metaJson = meta == null ? null : JSON.stringify(meta)

    return withTransaction(async (conn) => {
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

/* ---------------------------------------------------------------------- */

export async function createUserWithTempPassword(
  email: string,
  roles: string[] = ['user'],
): Promise<{ id: string; tempPassword: string }> {
    const id = randomUUID()
    const normalizedEmail = email.trim().toLowerCase()
    const username = normalizedEmail // deterministic, satisfies UNIQUE(username)
    const tempPassword = generatePassword(14)
    const passwordHash = await hashPassword(tempPassword)

    try {
        await withTransaction(async (conn) => {
        await conn.execute(
            `
            INSERT INTO users (
            id, email, username, password,
            is_active, roles, permissions,
            totp_enabled, force_password_change,
            temp_password_issued_at, temp_password_used_at,
            created_at, updated_at
            )
            VALUES (
            UNHEX(REPLACE(?, '-', '')), ?, ?, ?,
            1, ?, '[]',
            0, 1,
            NOW(), NULL,
            NOW(), NOW()
            )
            `,
            [id, normalizedEmail, username, passwordHash, JSON.stringify(roles)],
        )

        await conn.execute(
            `
            INSERT INTO user_profile (user_id, first_name, last_name, phone_number, timezone)
            VALUES (UNHEX(REPLACE(?, '-', '')), NULL, NULL, NULL, NULL)
            `,
            [id],
        )
        })
    } catch (err: unknown) {
        const code = getErrorCode(err)
        if (code === 'ER_DUP_ENTRY') {
            throw Object.assign(new Error('duplicate_user'), { code: 'duplicate_user', cause: err })
        }
        throw err
    }

    return { id, tempPassword }
}

/* ---------------------------------------------------------------------- */

export async function upsertTotpSecret(userId: string, secretB32: string): Promise<void> {
  await exec(
    `
    INSERT INTO user_totp (user_id, secret_b32, enrolled_at)
    VALUES (UNHEX(REPLACE(?, '-', '')), ?, NOW())
    ON DUPLICATE KEY UPDATE
      secret_b32 = VALUES(secret_b32),
      enrolled_at = VALUES(enrolled_at)
    `,
    [userId, secretB32]
  )
}

/* ---------------------------------------------------------------------- */

export async function getUserProfileById(userId: string): Promise<UserProfile> {
  return withTransaction(async (conn) => {
    console.log("[USR-PRF-DB] Trying to retrieve data for: "+userId)
    const existing = await readUserProfile(userId)
    if (existing) 
        return existing
    await conn.execute(
      `
      INSERT INTO user_profile (user_id, first_name, last_name, phone_number, timezone)
      VALUES (UNHEX(REPLACE(?, '-', '')), '', '', '', '')
      `,
      [userId]
    )
    const created = await readUserProfile(userId)
    if (!created) {
      throw new Error('failed_to_create_user_profile')
    }
    return created
  })
}

/* ---------------------------------------------------------------------- */