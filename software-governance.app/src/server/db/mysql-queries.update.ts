/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/db/mysql-queries.update.ts */
/* ---------------------------------------------------------------------- */

import { keyRule, normalizeRowsWithKeys } from "@devcoons/row-normalizer";
import { exec, query, withConnection, withTransaction } from "./mysql-client";
import { DbUserVisual, UserProfile, UserVisual } from "./mysql-types";
import { rules } from "./mysql-utils";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { PoolConnection } from "mysql2/promise";
import { readUserProfile } from "./mysql-queries.select";

/* ---------------------------------------------------------------------- */

export async function burnTempPassword(userId: string, unusableHash: string): Promise<void> {
  await exec(
    `
    UPDATE users
    SET password = ?, temp_password_used_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
      AND temp_password_issued_at IS NOT NULL
      AND temp_password_used_at IS NULL
    `,
    [unusableHash, userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function completeForcedPasswordChange(userId: string, newHash: string): Promise<void> {
  await exec(
    `
    UPDATE users
    SET password = ?,
        force_password_change = 0,
        temp_password_issued_at = NULL,
        temp_password_used_at = NULL,
        updated_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [newHash, userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function enableTotp(userId: string): Promise<void> {
  await exec(
    `
    UPDATE users
    SET totp_enabled = 1, updated_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function updateLastLogin(userId: string|undefined): Promise<void> {
    console.log("[USR-DB] Update Last login date for user: "+userId)
    if(!userId) return
  await exec(
    `
    UPDATE users
    SET last_login_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await exec(
    `
    UPDATE users
    SET
      password = ?,
      force_password_change = 0,
      temp_password_issued_at = NULL,
      temp_password_used_at = NULL,
      updated_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [passwordHash, userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function setUserTempPassword(userId: string, passwordHash: string): Promise<void> {
  await exec(
    `
    UPDATE users
    SET
      password = ?,
      force_password_change = 1,
      temp_password_issued_at = CURRENT_TIMESTAMP,
      temp_password_used_at = NULL,
      updated_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [passwordHash, userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function toggleStatus(userId: string): Promise<boolean | null> {
  return withTransaction<boolean | null>(async (conn: PoolConnection) => {
    const [rows] = await conn.execute<RowDataPacket[]>(
      `
      SELECT is_active
      FROM users
      WHERE id = UNHEX(REPLACE(?, '-', ''))
      FOR UPDATE
      `,
      [userId]
    )
    const row = rows[0] as RowDataPacket | undefined
    if (!row || typeof row.is_active === 'undefined') return null
    const prev = Boolean(row.is_active)
    const next = prev ? 0 : 1
    const [upd] = await conn.execute<ResultSetHeader>(
      `
      UPDATE users
      SET is_active = ?, updated_at = NOW()
      WHERE id = UNHEX(REPLACE(?, '-', ''))
      `,
      [next, userId]
    )
    if (!upd.affectedRows) return null
    return Boolean(next)
  })
}

/* ---------------------------------------------------------------------- */

export async function setUserRole(userId: string, roles: string[]): Promise<void> {
  await exec(
    `
    UPDATE users
    SET roles = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [JSON.stringify(roles), userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileFirstNameById(userId: string, firstName: string): Promise<UserProfile> {
  return withConnection(async (conn) => {
    await conn.execute(
      `
      UPDATE user_profile SET first_name = ?
      WHERE user_id = UNHEX(REPLACE(?, '-', ''))
      `,
      [firstName, userId]
    )
    const p = await readUserProfile(userId)
    if (!p) throw new Error('profile_not_found_after_update')
    return p
  })
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileLastNameById(userId: string, lastName: string): Promise<UserProfile> {
  return withConnection(async (conn) => {
    await conn.execute(
      `
      UPDATE user_profile SET last_name = ?
      WHERE user_id = UNHEX(REPLACE(?, '-', ''))
      `,
      [lastName, userId]
    )
    const p = await readUserProfile(userId)
    if (!p) throw new Error('profile_not_found_after_update')
    return p
  })
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfilePhoneNumberById(userId: string, phoneNumber: string): Promise<UserProfile> {
  return withConnection(async (conn) => {
    await conn.execute(
      `
      UPDATE user_profile SET phone_number = ?
      WHERE user_id = UNHEX(REPLACE(?, '-', ''))
      `,
      [phoneNumber, userId]
    )
    const p = await readUserProfile(userId)
    if (!p) throw new Error('profile_not_found_after_update')
    return p
  })
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileTimezoneById(userId: string, timezone: string): Promise<UserProfile> {
  return withConnection(async (conn) => {
    await conn.execute(
      `
      UPDATE user_profile SET timezone = ?
      WHERE user_id = UNHEX(REPLACE(?, '-', ''))
      `,
      [timezone, userId]
    )
    const p = await readUserProfile(userId)
    if (!p) throw new Error('profile_not_found_after_update')
    return p
  })
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileById(
  userId: string,
  firstName: string,
  lastName: string,
  phoneNumber: string,
  timezone: string
): Promise<UserProfile> {
  return withConnection(async (conn) => {
    await conn.execute(
      `
      UPDATE user_profile
      SET first_name = ?, last_name = ?, phone_number = ?, timezone = ?
      WHERE user_id = UNHEX(REPLACE(?, '-', ''))
      `,
      [firstName, lastName, phoneNumber, timezone, userId]
    )
    const p = await readUserProfile(userId)
    if (!p) throw new Error('profile_not_found_after_update')
    return p
  })
}

/* ---------------------------------------------------------------------- */